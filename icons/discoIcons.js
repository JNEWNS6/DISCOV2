(function() {
  const BASE_SIZE = 128;

  function createCanvas(size) {
    if (!Number.isFinite(size) || size <= 0) return null;
    if (typeof OffscreenCanvas !== "undefined") {
      const canvas = new OffscreenCanvas(size, size);
      return canvas;
    }
    if (typeof document !== "undefined" && typeof document.createElement === "function") {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      return canvas;
    }
    return null;
  }

  function drawIcon(ctx, size) {
    if (!ctx || !Number.isFinite(size)) return;
    ctx.clearRect(0, 0, size, size);
    const scale = size / BASE_SIZE;
    ctx.save();
    ctx.scale(scale, scale);
    ctx.clearRect(0, 0, BASE_SIZE, BASE_SIZE);

    const baseBaseline = 70;
    const baseStartX = 12;
    const label = "DISC";

    ctx.fillStyle = "#1f1f24";
    ctx.font = "700 52px 'Segoe UI','Helvetica Neue','Arial Black',sans-serif";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillText(label, baseStartX, baseBaseline);

    const metrics = ctx.measureText(label);
    const textWidth = metrics && metrics.width ? metrics.width : 0;
    const radius = 30;
    const padding = 10;
    const maxCx = BASE_SIZE - radius - padding;
    let circleCx = baseStartX + textWidth + radius * 1.05;
    if (circleCx > maxCx) circleCx = maxCx;
    const circleCy = baseBaseline;

    const highlightShiftX = radius * 0.35;
    const highlightShiftY = radius * 0.45;

    const gradient = ctx.createRadialGradient(
      circleCx - radius * 0.45,
      circleCy - radius * 0.55,
      radius * 0.25,
      circleCx,
      circleCy,
      radius
    );
    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(0.55, "#d9dbe3");
    gradient.addColorStop(1, "#8f9098");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(circleCx, circleCy, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(31,31,36,0.55)";
    ctx.beginPath();
    ctx.arc(circleCx, circleCy, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(31,31,36,0.38)";
    const meridians = [-0.55, -0.2, 0.2, 0.55];
    for (const offset of meridians) {
      ctx.beginPath();
      ctx.ellipse(
        circleCx + offset * radius * 0.18,
        circleCy,
        radius * (1 - Math.abs(offset) * 0.18),
        radius,
        0,
        0,
        Math.PI * 2
      );
      ctx.stroke();
    }

    const parallels = [-0.65, -0.35, 0, 0.35, 0.65];
    for (const offset of parallels) {
      ctx.beginPath();
      ctx.ellipse(
        circleCx,
        circleCy + offset * radius * 0.35,
        radius,
        radius * (1 - Math.abs(offset) * 0.35),
        0,
        0,
        Math.PI * 2
      );
      ctx.stroke();
    }

    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.beginPath();
    ctx.arc(
      circleCx - highlightShiftX,
      circleCy - highlightShiftY,
      radius * 0.65,
      Math.PI * 1.05,
      Math.PI * 1.45
    );
    ctx.stroke();

    ctx.restore();
  }

  function drawToCanvas(size) {
    const canvas = createCanvas(size);
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    drawIcon(ctx, size);
    return canvas;
  }

  self.getDiscoIconImageData = async function(size) {
    const canvas = drawToCanvas(size);
    if (!canvas) return null;
    const context = canvas.getContext("2d");
    if (!context) return null;
    try {
      return context.getImageData(0, 0, size, size);
    } catch (error) {
      console.warn("[Disco] Unable to capture icon image data", error);
      return null;
    }
  };

  function encodeBlobAsDataUrl(blob) {
    if (!blob) return Promise.resolve(null);
    if (typeof blob.arrayBuffer === "function") {
      return blob.arrayBuffer().then((buffer) => {
        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (let i = 0; i < bytes.length; i += 1) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = typeof btoa === "function"
          ? btoa(binary)
          : (typeof Buffer !== "undefined" ? Buffer.from(binary, "binary").toString("base64") : null);
        if (!base64) return null;
        return `data:${blob.type || "image/png"};base64,${base64}`;
      });
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  self.getDiscoIconDataUrl = async function(size) {
    const canvas = drawToCanvas(size);
    if (!canvas) return null;
    if (typeof canvas.toDataURL === "function") {
      try {
        return canvas.toDataURL("image/png");
      } catch (error) {
        console.warn("[Disco] Canvas toDataURL failed", error);
      }
    }
    if (typeof canvas.convertToBlob === "function") {
      try {
        const blob = await canvas.convertToBlob({ type: "image/png" });
        return await encodeBlobAsDataUrl(blob);
      } catch (error) {
        console.warn("[Disco] convertToBlob failed", error);
      }
    }
    return null;
  };
})();
