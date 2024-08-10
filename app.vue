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

    <canvas ref="canvas" class="drawing-canvas"></canvas>
    <video ref="recordedVideo" controls></video>
    <a :href="downloadLink" v-if="downloadLink" download="recorded-video.webm"
      >Download Video</a
    >

    <!-- 제출 버튼 추가 -->
    <button @click="submitVideo" :disabled="!downloadLink">Submit Video</button>
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
const penColor = ref("#fff"); // 기본 색상 설정
const penSize = ref(5); // 기본 펜 크기 설정
const eraserSize = ref(20); // 기본 지우개 크기 설정

const startRecording = async () => {
  try {
    const stream = canvas.value.captureStream(30); // 30 FPS로 스트림 생성
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
  draw(event);
};

const endDrawing = () => {
  drawing.value = false;
  ctx.value.beginPath();
};

const draw = (event) => {
  if (!drawing.value) return;

  ctx.value.lineWidth = eraseMode.value ? eraserSize.value : penSize.value;
  ctx.value.lineCap = "round";

  if (eraseMode.value) {
    ctx.value.globalCompositeOperation = "destination-out";
    ctx.value.strokeStyle = "rgba(0,0,0,1)";
  } else {
    ctx.value.globalCompositeOperation = "source-over";
    ctx.value.strokeStyle = penColor.value;
  }

  const rect = canvas.value.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  ctx.value.lineTo(x, y);
  ctx.value.stroke();
  ctx.value.beginPath();
  ctx.value.moveTo(x, y);
};

const toggleEraseMode = () => {
  eraseMode.value = !eraseMode.value;
};

const submitVideo = async () => {
  if (!downloadLink.value) return;

  try {
    const response = await fetch(downloadLink.value);
    const blob = await response.blob();

    const formData = new FormData();
    formData.append("video", blob, "recorded-video.webm");

    const uploadResponse = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    if (uploadResponse.ok) {
      alert("Video uploaded successfully!");
    } else {
      alert("Video upload failed.");
    }
  } catch (error) {
    console.error("Error uploading video:", error);
  }
};

onMounted(() => {
  canvas.value.width = 800;
  canvas.value.height = 600;
  ctx.value = canvas.value.getContext("2d");

  // Image 객체를 onMounted에서 생성
  image.value = new Image();

  image.value.onload = () => {
    ctx.value.drawImage(
      image.value,
      0,
      0,
      canvas.value.width,
      canvas.value.height
    );
  };

  canvas.value.addEventListener("mousedown", startDrawing);
  canvas.value.addEventListener("mouseup", endDrawing);
  canvas.value.addEventListener("mousemove", draw);
});
</script>

<style scoped>
.drawing-canvas {
  border: 2px solid #000;
  display: block;
  margin-top: 20px;
  width: 100%;
  max-width: 800px;
  height: auto;
  background-color: green;
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
</style>
