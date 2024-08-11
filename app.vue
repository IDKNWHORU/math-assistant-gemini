<template>
  <div>
    <input type="file" @change="onImageUpload" accept="image/*" />
    <button @click="startRecording">Start Recording</button>
    <button @click="stopRecording" :disabled="!isRecording">
      Stop Recording
    </button>

    <!-- 색상 선택 도구 -->
    <label for="colorPicker">Pen Color:</label>
    <input type="color" id="colorPicker" v-model="penColor" />

    <!-- 펜 두께 조절 -->
    <label for="penSize">Pen Size:</label>
    <input
      type="number"
      id="penSize"
      v-model.number="penSize"
      min="1"
      max="50"
    />

    <!-- 지우기 도구 -->
    <label for="eraserSize">Eraser Size:</label>
    <input
      type="number"
      id="eraserSize"
      v-model.number="eraserSize"
      min="1"
      max="50"
    />

    <button @click="toggleEraseMode" :class="{ active: eraseMode }">
      {{ eraseMode ? "Drawing Mode" : "Erase Mode" }}
    </button>

    <!-- <canvas ref="canvas" class="drawing-canvas"></canvas> -->
    <div class="canvas-container">
      <canvas ref="imageCanvas" class="image-canvas"></canvas>
      <canvas ref="drawingCanvas" class="drawing-canvas"></canvas>
    </div>

    <!-- 제출 버튼 추가 -->
    <button @click="submitVideo" :disabled="!downloadLink" class="submit">
      Submit Video
    </button>
    <div class="result">{{ result }}</div>
    <video ref="recordedVideo" controls></video>
    <a :href="downloadLink" v-if="downloadLink" download="recorded-video.webm"
      >Download Video</a
    >
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";

const canvas = ref(null);
const ctx = ref(null);
const recordedVideo = ref(null);
const mediaRecorder = ref(null);
const recordedChunks = ref([]);
const isRecording = ref(false);
const downloadLink = ref(null);
const drawing = ref(false);
const eraseMode = ref(false);
const image = ref(null);
const penColor = ref("#f00"); // 기본 색상 설정
const penSize = ref(5); // 기본 펜 크기 설정
const eraserSize = ref(20); // 기본 지우개 크기 설정
const result = ref("");
const imageCanvas = ref(null);
const imageCtx = ref(null);
const drawingCanvas = ref(null);
const drawingCtx = ref(null);

const startRecording = async () => {
  try {
    // 임시 캔버스 생성
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = imageCanvas.value.width;
    tempCanvas.height = imageCanvas.value.height;
    const tempCtx = tempCanvas.getContext("2d");

    // 캔버스 합치기 함수
    const mergeCanvases = () => {
      tempCtx.drawImage(imageCanvas.value, 0, 0);
      tempCtx.drawImage(drawingCanvas.value, 0, 0);
    };

    // 스트림 생성
    const stream = tempCanvas.captureStream(30); // 30 FPS

    // 주기적으로 캔버스 합치기
    setInterval(mergeCanvases, 1000 / 30); // 30 FPS에 맞춰 업데이트

    const audioStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });

    // 오디오 트랙을 캔버스 스트림에 추가
    audioStream.getAudioTracks().forEach((track) => stream.addTrack(track));

    mediaRecorder.value = new MediaRecorder(stream);

    mediaRecorder.value.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunks.value.push(event.data);
      }
    };

    mediaRecorder.value.onstop = () => {
      const blob = new Blob(recordedChunks.value, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      if (recordedVideo.value) {
        recordedVideo.value.src = url;
      }
      downloadLink.value = url;
    };

    mediaRecorder.value.start();
    isRecording.value = true;
  } catch (err) {
    console.error("Error: " + err);
  }
};

const stopRecording = () => {
  if (mediaRecorder.value && mediaRecorder.value.state !== "inactive") {
    mediaRecorder.value.stop();
    isRecording.value = false;
  }
};

const onImageUpload = (event) => {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      image.value.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }
};

const startDrawing = (event) => {
  drawing.value = true;
  const rect = drawingCanvas.value.getBoundingClientRect();
  const x = (event.clientX || event.touches[0].clientX) - rect.left;
  const y = (event.clientY || event.touches[0].clientY) - rect.top;
  drawingCtx.value.beginPath();
  drawingCtx.value.moveTo(x, y);
};

const endDrawing = () => {
  drawing.value = false;
  drawingCtx.value.beginPath(); // 경로 초기화
};

const draw = (event) => {
  if (!drawing.value) return;

  drawingCtx.value.lineWidth = eraseMode.value
    ? eraserSize.value
    : penSize.value;
  drawingCtx.value.lineCap = "round";

  if (eraseMode.value) {
    drawingCtx.value.globalCompositeOperation = "destination-out";
  } else {
    drawingCtx.value.globalCompositeOperation = "source-over";
    drawingCtx.value.strokeStyle = penColor.value;
  }

  const rect = drawingCanvas.value.getBoundingClientRect();
  const x = (event.clientX || event.touches[0].clientX) - rect.left;
  const y = (event.clientY || event.touches[0].clientY) - rect.top;

  drawingCtx.value.lineTo(x, y);
  drawingCtx.value.stroke();
};

const redrawImage = () => {
  if (image.value.src) {
    ctx.value.globalCompositeOperation = "source-over";
    ctx.value.drawImage(
      image.value,
      0,
      0,
      canvas.value.width,
      canvas.value.height
    );
  }
};

const toggleEraseMode = () => {
  eraseMode.value = !eraseMode.value;
};

const submitVideo = async () => {
  if (!downloadLink.value) return;

  result.value = "AI가 분석하는 중입니다... 기다려주세요";
  try {
    const response = await fetch(downloadLink.value);
    const blob = await response.blob();

    const formData = new FormData();
    formData.append("video", blob, "recorded-video.webm");

    const uploadResponse = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    result.value = await uploadResponse.text();
  } catch (error) {
    console.error("Error uploading video:", error);
    alert("Error uploading video:", error);
  }
};

const handleTouchStart = (event) => {
  event.preventDefault();
  const touch = event.touches[0];
  startDrawing(touch);
};

const handleTouchMove = (event) => {
  event.preventDefault();
  const touch = event.touches[0];
  draw(touch);
};

const handleTouchEnd = (event) => {
  event.preventDefault();
  endDrawing();
};

onMounted(() => {
  imageCanvas.value.width = drawingCanvas.value.width = 800;
  imageCanvas.value.height = drawingCanvas.value.height = 600;
  imageCtx.value = imageCanvas.value.getContext("2d");
  drawingCtx.value = drawingCanvas.value.getContext("2d");

  image.value = new Image();

  image.value.onload = () => {
    imageCtx.value.drawImage(
      image.value,
      0,
      0,
      imageCanvas.value.width,
      imageCanvas.value.height
    );
  };

  drawingCanvas.value.addEventListener("mousedown", startDrawing);
  drawingCanvas.value.addEventListener("mouseup", endDrawing);
  drawingCanvas.value.addEventListener("mousemove", draw);
  drawingCanvas.value.addEventListener("mouseout", endDrawing);

  drawingCanvas.value.addEventListener("touchstart", handleTouchStart);
  drawingCanvas.value.addEventListener("touchmove", handleTouchMove);
  drawingCanvas.value.addEventListener("touchend", handleTouchEnd);
});
</script>

<style scoped>
.canvas-container {
  position: relative;
  width: 800px;
  height: 600px;
  margin-top: 20px;
}

.image-canvas,
.drawing-canvas {
  position: absolute;
  top: 0;
  left: 0;
  border: 2px solid #000;
}

.drawing-canvas {
  z-index: 1;
}

video {
  display: block;
  margin-top: 20px;
  width: 100%;
  max-width: 800px;
  height: auto;
}

button {
  margin-right: 10px;
}

input[type="color"],
input[type="number"] {
  margin-right: 10px;
}

button.active {
  background-color: #007bff;
  color: white;
}

.result {
  width: 100%;
  height: 600px;
  overflow-y: auto;
  border: 2px solid #000;
}

.submit {
  margin: 20px 0;
}
</style>
