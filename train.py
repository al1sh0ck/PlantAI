"""
PlantAI - Model Training Script
Trains EfficientNet-B0 on 3-class plant health dataset.

Classes:
    Healthy/           — clearly healthy plants
    Partially_Healthy/ — early-stage disease or stress
    Unhealthy/         — severely diseased plants

Usage:
    python train.py --data_dir ./data/PlantHealth --epochs 30 --batch_size 32

Dataset structure:
    data/PlantHealth/
        Healthy/
            img001.jpg ...
        Partially_Healthy/
            img001.jpg ...
        Unhealthy/
            img001.jpg ...
"""

import argparse
import time
import copy
import json
import random
from pathlib import Path

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, Subset
from torchvision import models, transforms, datasets
from torch.optim.lr_scheduler import CosineAnnealingLR
from sklearn.metrics import classification_report, confusion_matrix
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns

# ─── Arguments ───────────────────────────────────────────────

def get_args():
    parser = argparse.ArgumentParser(description="Train PlantAI 3-class health classifier")
    parser.add_argument("--data_dir",   type=str,   default="./data/PlantHealth")
    parser.add_argument("--output_dir", type=str,   default="./models")
    parser.add_argument("--epochs",     type=int,   default=30)
    parser.add_argument("--batch_size", type=int,   default=32)
    parser.add_argument("--lr",         type=float, default=1e-4)
    parser.add_argument("--patience",   type=int,   default=7)
    parser.add_argument("--seed",       type=int,   default=42)
    return parser.parse_args()

# ─── Transforms ──────────────────────────────────────────────

TRAIN_TRANSFORM = transforms.Compose([
    transforms.Resize((256, 256)),
    transforms.RandomCrop(224),
    transforms.RandomHorizontalFlip(),
    transforms.RandomVerticalFlip(),
    transforms.RandomRotation(30),
    transforms.ColorJitter(brightness=0.3, contrast=0.3, saturation=0.2, hue=0.1),
    transforms.RandomAffine(degrees=0, translate=(0.1, 0.1)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

VAL_TRANSFORM = transforms.Compose([
    transforms.Resize((256, 256)),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

# ─── Model ───────────────────────────────────────────────────

def build_model(num_classes: int) -> nn.Module:
    """EfficientNet-B0 with transfer learning. Last 2 blocks + classifier are trainable."""
    model = models.efficientnet_b0(weights=models.EfficientNet_B0_Weights.IMAGENET1K_V1)

    # Freeze all, then unfreeze last blocks
    for param in model.parameters():
        param.requires_grad = False
    for param in model.features[6:].parameters():
        param.requires_grad = True

    in_features = model.classifier[1].in_features
    model.classifier = nn.Sequential(
        nn.Dropout(p=0.3, inplace=True),
        nn.Linear(in_features, num_classes)
    )
    return model

# ─── Dataset Split ────────────────────────────────────────────

def make_splits(data_dir: str, seed: int):
    """
    Create train/val/test splits with correct transforms applied per split.
    Uses three separate dataset instances to avoid the shared-transform bug.
    Split: 70% train / 15% val / 15% test — stratified by class.
    """
    train_dataset = datasets.ImageFolder(data_dir, transform=TRAIN_TRANSFORM)
    val_dataset   = datasets.ImageFolder(data_dir, transform=VAL_TRANSFORM)
    test_dataset  = datasets.ImageFolder(data_dir, transform=VAL_TRANSFORM)

    class_names = train_dataset.classes
    targets = train_dataset.targets

    # Stratified split: collect indices per class
    rng = random.Random(seed)
    train_idx, val_idx, test_idx = [], [], []

    for cls_idx in range(len(class_names)):
        cls_indices = [i for i, t in enumerate(targets) if t == cls_idx]
        rng.shuffle(cls_indices)
        n = len(cls_indices)
        n_train = int(0.70 * n)
        n_val   = int(0.15 * n)
        train_idx.extend(cls_indices[:n_train])
        val_idx.extend(cls_indices[n_train:n_train + n_val])
        test_idx.extend(cls_indices[n_train + n_val:])

    train_set = Subset(train_dataset, train_idx)
    val_set   = Subset(val_dataset,   val_idx)
    test_set  = Subset(test_dataset,  test_idx)

    return train_set, val_set, test_set, class_names

# ─── Training Loop ────────────────────────────────────────────

def train_epoch(model, loader, criterion, optimizer, device):
    model.train()
    running_loss, correct, total = 0.0, 0, 0
    for images, labels in loader:
        images, labels = images.to(device), labels.to(device)
        optimizer.zero_grad()
        outputs = model(images)
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()
        running_loss += loss.item() * images.size(0)
        _, predicted = outputs.max(1)
        correct += predicted.eq(labels).sum().item()
        total += images.size(0)
    return running_loss / total, correct / total

def validate(model, loader, criterion, device):
    model.eval()
    running_loss, correct, total = 0.0, 0, 0
    all_preds, all_labels = [], []
    with torch.no_grad():
        for images, labels in loader:
            images, labels = images.to(device), labels.to(device)
            outputs = model(images)
            loss = criterion(outputs, labels)
            running_loss += loss.item() * images.size(0)
            _, predicted = outputs.max(1)
            correct += predicted.eq(labels).sum().item()
            total += images.size(0)
            all_preds.extend(predicted.cpu().numpy())
            all_labels.extend(labels.cpu().numpy())
    return running_loss / total, correct / total, all_preds, all_labels

# ─── Plotting ─────────────────────────────────────────────────

def save_training_curves(history, output_path):
    epochs_range = [h["epoch"] for h in history]
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))
    fig.suptitle("PlantAI Training Results", fontsize=15, fontweight="bold")

    axes[0].plot(epochs_range, [h["train_loss"] for h in history], label="Train", color="#2e7d4f", linewidth=2)
    axes[0].plot(epochs_range, [h["val_loss"]   for h in history], label="Val",   color="#d97706", linewidth=2, linestyle="--")
    axes[0].set_title("Loss"); axes[0].set_xlabel("Epoch"); axes[0].legend()
    axes[0].grid(True, alpha=0.3)

    axes[1].plot(epochs_range, [h["train_acc"] for h in history], label="Train", color="#2e7d4f", linewidth=2)
    axes[1].plot(epochs_range, [h["val_acc"]   for h in history], label="Val",   color="#d97706", linewidth=2, linestyle="--")
    axes[1].set_title("Accuracy"); axes[1].set_xlabel("Epoch"); axes[1].set_ylim(0, 1); axes[1].legend()
    axes[1].grid(True, alpha=0.3)

    plt.tight_layout()
    plt.savefig(output_path / "training_curves.png", dpi=150, bbox_inches="tight")
    plt.close()
    print(f"[PlantAI] Training curves saved.")

def save_confusion_matrix(labels, preds, class_names, output_path):
    cm = confusion_matrix(labels, preds)
    fig, ax = plt.subplots(figsize=(8, 6))
    sns.heatmap(
        cm, annot=True, fmt="d", cmap="Greens",
        xticklabels=class_names, yticklabels=class_names,
        ax=ax, linewidths=0.5
    )
    ax.set_title("Confusion Matrix — Test Set", fontsize=13, fontweight="bold")
    ax.set_xlabel("Predicted Label"); ax.set_ylabel("True Label")
    plt.tight_layout()
    plt.savefig(output_path / "confusion_matrix.png", dpi=150, bbox_inches="tight")
    plt.close()
    print(f"[PlantAI] Confusion matrix saved.")

# ─── Main ────────────────────────────────────────────────────

def main():
    args = get_args()
    torch.manual_seed(args.seed)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[PlantAI] Training on: {device}")

    # Data
    train_set, val_set, test_set, class_names = make_splits(args.data_dir, args.seed)
    num_classes = len(class_names)
    print(f"[PlantAI] Classes ({num_classes}): {class_names}")
    print(f"[PlantAI] Train: {len(train_set)} | Val: {len(val_set)} | Test: {len(test_set)}")

    train_loader = DataLoader(train_set, batch_size=args.batch_size, shuffle=True,  num_workers=4, pin_memory=True)
    val_loader   = DataLoader(val_set,   batch_size=args.batch_size, shuffle=False, num_workers=4)
    test_loader  = DataLoader(test_set,  batch_size=args.batch_size, shuffle=False, num_workers=4)

    # Model
    model = build_model(num_classes).to(device)

    # Class-weighted loss (helps with imbalanced datasets)
    class_counts = np.bincount([train_set.dataset.targets[i] for i in train_set.indices])
    class_weights = torch.tensor(1.0 / class_counts, dtype=torch.float).to(device)
    criterion = nn.CrossEntropyLoss(weight=class_weights)

    optimizer = optim.AdamW(
        filter(lambda p: p.requires_grad, model.parameters()),
        lr=args.lr, weight_decay=1e-4
    )
    scheduler = CosineAnnealingLR(optimizer, T_max=args.epochs, eta_min=1e-6)

    # Training loop
    best_val_acc = 0.0
    best_weights = copy.deepcopy(model.state_dict())
    patience_counter = 0
    history = []

    print(f"\n{'Epoch':>6} {'TrainLoss':>10} {'TrainAcc':>10} {'ValLoss':>10} {'ValAcc':>10} {'Time':>7}")
    print("─" * 60)

    for epoch in range(1, args.epochs + 1):
        t0 = time.time()
        train_loss, train_acc = train_epoch(model, train_loader, criterion, optimizer, device)
        val_loss, val_acc, _, _ = validate(model, val_loader, criterion, device)
        scheduler.step()
        elapsed = time.time() - t0

        history.append({
            "epoch": epoch, "train_loss": train_loss, "train_acc": train_acc,
            "val_loss": val_loss, "val_acc": val_acc
        })
        print(f"{epoch:>6} {train_loss:>10.4f} {train_acc:>10.4f} {val_loss:>10.4f} {val_acc:>10.4f} {elapsed:>6.0f}s")

        if val_acc > best_val_acc:
            best_val_acc = val_acc
            best_weights = copy.deepcopy(model.state_dict())
            patience_counter = 0
            print(f"         ✓ New best val acc: {best_val_acc:.4f}")
        else:
            patience_counter += 1
            if patience_counter >= args.patience:
                print(f"\n[PlantAI] Early stopping triggered at epoch {epoch}")
                break

    # Final evaluation
    model.load_state_dict(best_weights)
    print("\n[PlantAI] Evaluating on test set...")
    _, test_acc, preds, labels = validate(model, test_loader, criterion, device)
    print(f"Test Accuracy: {test_acc:.4f}")
    print("\nClassification Report:")
    print(classification_report(labels, preds, target_names=class_names))

    # Save outputs
    output_path = Path(args.output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    torch.save(model.state_dict(), output_path / "plantai_efficientnet_b0.pth")
    with open(output_path / "class_names.json", "w") as f:
        json.dump(class_names, f, indent=2)

    save_training_curves(history, output_path)
    save_confusion_matrix(labels, preds, class_names, output_path)

    print(f"\n[PlantAI] All outputs saved to {output_path}/")
    print(f"[PlantAI] Best val accuracy: {best_val_acc:.4f} | Test accuracy: {test_acc:.4f}")

if __name__ == "__main__":
    main()
