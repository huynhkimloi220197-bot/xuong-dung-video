// Chạy Whisper ở luồng riêng để trang không bị đơ. Nhận { audio16k, model } → trả các đoạn chữ có thời gian.
const TF = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2';
let asr = null, dangMo = null;

async function mo(model) {
  if (asr?.model === model) return asr.p;
  const { pipeline, env } = await import(TF);
  env.allowLocalModels = false;                       // luôn lấy từ Hugging Face, trình duyệt tự lưu lại cho lần sau
  const tien = p => { if (p.status === 'progress' && p.total > 3e6) postMessage({ loai: 'tien', chu: `Tải bộ nghe chữ ${Math.round(p.progress)}% (chỉ lần đầu)` }); };
  const p = await pipeline('automatic-speech-recognition', `onnx-community/${model}`, { device: 'wasm', dtype: 'q8', progress_callback: tien });
  asr = { model, p }; return p;
}

onmessage = async ({ data }) => {
  const { id, audio, model } = data;
  try {
    dangMo ||= mo(model); const p = await dangMo; dangMo = null;
    postMessage({ loai: 'tien', chu: 'Đang nghe lời nói…' });
    const out = await p(audio, { language: 'vietnamese', task: 'transcribe', return_timestamps: true, chunk_length_s: 30, stride_length_s: 5 });
    postMessage({ loai: 'xong', id, chunks: out.chunks || [{ text: out.text, timestamp: [0, audio.length / 16000] }] });
  } catch (e) { dangMo = null; postMessage({ loai: 'loi', id, chu: e.message || String(e) }); }
};
