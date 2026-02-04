from PIL import Image
import os

images = ['profile.jpg', 'profile.png']
for img_path in images:
    if os.path.exists(img_path):
        with Image.open(img_path) as img:
            print(f"{img_path}: {img.size} {img.format} {img.mode}")
    else:
        print(f"{img_path} not found")
