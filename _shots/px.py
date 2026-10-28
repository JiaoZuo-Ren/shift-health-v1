# -*- coding: utf-8 -*-
import sys
from PIL import Image

path = r'C:\Users\21793\Desktop\shift-health\_shots\_shots\dark-test2_desktop.jpg'
im = Image.open(path).convert('RGB')
w, h = im.size
print('size', w, h)
print('top-left', im.getpixel((20, 20)))
print('top-right', im.getpixel((w - 30, 30)))
print('center', im.getpixel((w // 2, h // 2)))
print('button-area', im.getpixel((w // 2, int(h * 0.55))))
print('footer-area', im.getpixel((w // 2, int(h * 0.92))))
