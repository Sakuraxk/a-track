import numpy as np
import random
import matplotlib.pyplot as plt
from wordcloud import WordCloud
from PIL import Image
import os

words_freq = {
    '武汉大学': 220,
    '樱花': 200,
    '珞珈山': 90,
    '樱花大道': 90,
    '东湖': 80,
    '老斋舍': 80,
    '凌波门': 70,
    '百年名校': 60,
    '毕业季': 60,
    '学术': 50,
    '热干面': 50
}

mask_path = r"C:\Users\30894\.gemini\antigravity\brain\3b6c1858-9443-4af3-83a9-a4604c3847e2\cherry_blossom_mask_1773724358406.png"

try:
    mask_img = Image.open(mask_path).convert('L')
    mask_arr = np.array(mask_img)
    mask_arr = np.where(mask_arr > 200, 255, 0).astype(np.uint8)
except Exception as e:
    print(f"Error loading mask: {e}")
    # Fallback to no mask so the script at least runs, though this should not fail.
    mask_arr = None

def warm_color_func(word, font_size, position, orientation, random_state=None, **kwargs):
    if word in ['武汉大学', '樱花']:
        colors = ["hsl(340, 85%, 45%)", "hsl(350, 80%, 50%)"]
    else:
        colors = [
            "hsl(350, 80%, 65%)", 
            "hsl(330, 80%, 70%)", 
            "hsl(10,  85%, 65%)", 
            "hsl(25,  85%, 60%)", 
            "hsl(45,  90%, 55%)", 
            "hsl(340, 70%, 55%)"  
        ]
    return random.choice(colors)

# Check fonts
font_opts = ['msyh.ttc', 'simhei.ttf', 'simkai.ttf']
font_path = 'msyh.ttc'
for fp in font_opts:
    if os.path.exists(f'C:/Windows/Fonts/{fp}'):
        font_path = f'C:/Windows/Fonts/{fp}'
        break

try:
    wc = WordCloud(
        font_path=font_path,
        background_color='#E8F4F8', # 清新淡蓝色
        mask=mask_arr,
        scale=3, # 提高清晰度
        max_words=250,
        max_font_size=180,
        min_font_size=12,
        color_func=warm_color_func,
        random_state=42,
        prefer_horizontal=0.6,
        repeat=True
    )

    wc.generate_from_frequencies(words_freq)

    out_path = r"D:\桌面\武汉大学_樱花词云图.png"
    wc.to_file(out_path)
    print(f"Word cloud successfully generated and saved to {out_path}")
except Exception as e:
    print(f"Error generating word cloud: {e}")
