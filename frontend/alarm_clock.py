import os
import webbrowser

def main():
    html_content = """
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>网页版闹钟</title>
        <style>
            body {
                margin: 0;
                padding: 0;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                color: #333;
            }
            .container {
                background: rgba(255, 255, 255, 0.95);
                padding: 40px 50px;
                border-radius: 20px;
                box-shadow: 0 15px 35px rgba(0,0,0,0.2);
                text-align: center;
                width: 320px;
                backdrop-filter: blur(10px);
            }
            h1 {
                margin-top: 0;
                color: #333;
                font-size: 28px;
            }
            .time-display {
                font-size: 72px;
                font-weight: bold;
                margin: 20px 0;
                color: #764ba2;
                text-shadow: 2px 2px 4px rgba(0,0,0,0.1);
                font-variant-numeric: tabular-nums;
                letter-spacing: 2px;
            }
            .inputs {
                display: flex;
                justify-content: center;
                gap: 20px;
                margin-bottom: 30px;
            }
            .inputs input {
                width: 70px;
                padding: 12px;
                font-size: 20px;
                border: 2px solid #ddd;
                border-radius: 12px;
                text-align: center;
                outline: none;
                transition: all 0.3s ease;
                background: #f9f9f9;
            }
            .inputs input:focus {
                border-color: #764ba2;
                box-shadow: 0 0 8px rgba(118, 75, 162, 0.3);
                background: #fff;
            }
            .inputs label {
                display: flex;
                flex-direction: column;
                font-size: 14px;
                color: #666;
                align-items: center;
                font-weight: 500;
                gap: 8px;
            }
            .buttons {
                display: flex;
                justify-content: center;
                gap: 15px;
            }
            button {
                background: #764ba2;
                color: white;
                border: none;
                padding: 14px 35px;
                font-size: 18px;
                font-weight: bold;
                border-radius: 50px;
                cursor: pointer;
                transition: all 0.3s ease;
                box-shadow: 0 5px 15px rgba(118, 75, 162, 0.4);
                flex-grow: 1;
            }
            button:hover {
                background: #5a3782;
                transform: translateY(-2px);
                box-shadow: 0 8px 20px rgba(118, 75, 162, 0.5);
            }
            button:active {
                transform: translateY(1px);
            }
            button.stop {
                background: #ff5252;
                box-shadow: 0 5px 15px rgba(255, 82, 82, 0.4);
            }
            button.stop:hover {
                background: #e04343;
                box-shadow: 0 8px 20px rgba(255, 82, 82, 0.5);
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>倒计时闹钟</h1>
            <div class="time-display" id="timeDisplay">00:00</div>
            <div class="inputs">
                <label>
                    <input type="number" id="minutes" min="0" max="99" value="0">
                    分钟
                </label>
                <label>
                    <input type="number" id="seconds" min="0" max="59" value="10">
                    秒钟
                </label>
            </div>
            <div class="buttons">
                <button id="startBtn" onclick="startTimer()">开始</button>
                <button id="stopBtn" class="stop" onclick="stopTimer()" style="display: none;">取消</button>
            </div>
        </div>

        <script>
            let timerInterval;
            let totalSeconds = 0;
            let audioContext;

            function playBeep() {
                if (!audioContext) {
                    audioContext = new (window.AudioContext || window.webkitAudioContext)();
                }
                if (audioContext.state === 'suspended') {
                    audioContext.resume();
                }
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(800, audioContext.currentTime); // 频率 800Hz
                
                gainNode.gain.setValueAtTime(0, audioContext.currentTime);
                gainNode.gain.linearRampToValueAtTime(1, audioContext.currentTime + 0.05);
                gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.5);
                
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                oscillator.start();
                oscillator.stop(audioContext.currentTime + 0.5);
            }

            function playAlarm() {
                // 播放三声提示音
                playBeep();
                setTimeout(playBeep, 600);
                setTimeout(playBeep, 1200);
            }

            function updateDisplay() {
                const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
                const s = (totalSeconds % 60).toString().padStart(2, '0');
                document.getElementById('timeDisplay').innerText = `${m}:${s}`;
            }

            function startTimer() {
                const m = parseInt(document.getElementById('minutes').value) || 0;
                const s = parseInt(document.getElementById('seconds').value) || 0;
                
                if (m === 0 && s === 0) {
                    alert("请设置有效的时间！");
                    return;
                }
                
                totalSeconds = m * 60 + s;
                
                document.getElementById('startBtn').style.display = 'none';
                document.getElementById('stopBtn').style.display = 'inline-block';
                document.getElementById('minutes').disabled = true;
                document.getElementById('seconds').disabled = true;
                
                updateDisplay();
                
                // 初始化 AudioContext 以便处理现代浏览器的播放策略
                if (!audioContext) {
                    audioContext = new (window.AudioContext || window.webkitAudioContext)();
                }
                if (audioContext.state === 'suspended') {
                    audioContext.resume();
                }

                timerInterval = setInterval(() => {
                    totalSeconds--;
                    updateDisplay();
                    
                    if (totalSeconds <= 0) {
                        clearInterval(timerInterval);
                        playAlarm();
                        // 稍作延迟弹窗，让第一声蜂鸣顺利播放
                        setTimeout(() => {
                            alert("时间到！");
                            resetUI();
                        }, 100);
                    }
                }, 1000);
            }

            function stopTimer() {
                clearInterval(timerInterval);
                resetUI();
            }

            function resetUI() {
                document.getElementById('startBtn').style.display = 'inline-block';
                document.getElementById('stopBtn').style.display = 'none';
                document.getElementById('minutes').disabled = false;
                document.getElementById('seconds').disabled = false;
                totalSeconds = 0;
                document.getElementById('timeDisplay').innerText = "00:00";
            }
        </script>
    </body>
    </html>
    """

    file_path = os.path.abspath("alarm.html")
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(html_content)
    
    print("====================================")
    print(f"闹钟网页已生成在本地: {file_path}")
    print("正在尝试在默认浏览器中打开...")
    print("====================================")
    
    # 自动在默认浏览器中打开
    webbrowser.open('file://' + file_path)

if __name__ == "__main__":
    main()
