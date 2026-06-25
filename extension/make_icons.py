"""Generate PNG icons for the extension using matplotlib."""
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import os

DPI = 96  # fixed rendering DPI

def make_icon(size, path):
    inches = size / DPI
    fig, ax = plt.subplots(figsize=(inches, inches), dpi=DPI)
    fig.patch.set_facecolor("#2C6EAF")
    ax.set_facecolor("#2C6EAF")
    ax.set_xlim(0, 1); ax.set_ylim(0, 1)
    ax.axis("off")
    # scale font sizes relative to icon size (minimum 6pt to avoid render errors)
    fs_main = max(6, size * 0.22)
    fs_sub  = max(5, size * 0.10)
    ax.text(0.5, 0.58, "ZDS", ha="center", va="center",
            fontsize=fs_main, fontweight="bold",
            color="white", fontfamily="monospace")
    if size >= 48:
        ax.text(0.5, 0.22, "r>r*", ha="center", va="center",
                fontsize=fs_sub, color="#a8ccf0", fontfamily="monospace")
    fig.savefig(path, dpi=DPI, bbox_inches="tight",
                facecolor="#2C6EAF", edgecolor="none", pad_inches=0)
    plt.close(fig)
    print(f"  {path}")

base = os.path.join(os.path.dirname(os.path.abspath(__file__)), "icons")
os.makedirs(base, exist_ok=True)
for sz in [16, 48, 128]:
    make_icon(sz, os.path.join(base, f"icon{sz}.png"))
print("Icons done.")
