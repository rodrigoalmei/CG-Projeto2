(function () {
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function createInspector({ canvas, marker, coordLabel, tableContainer, radius = 7, markerMode = "hover" }) {
    let image = null;
    let center = { x: 0, y: 0 };
    let hover = null;

    function setMarker(point) {
      if (!marker) return;

      if (!image || !point) {
        marker.style.display = "none";
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const markerWidth = Math.max(rect.width / image.width, 8);
      const markerHeight = Math.max(rect.height / image.height, 8);
      const left = (point.x / image.width) * rect.width;
      const top = (point.y / image.height) * rect.height;

      marker.style.display = "block";
      marker.style.width = `${markerWidth}px`;
      marker.style.height = `${markerHeight}px`;
      marker.style.left = `${left - markerWidth / 2}px`;
      marker.style.top = `${top - markerHeight / 2}px`;
    }

    function getPointFromCanvasEvent(event) {
      if (!image) return null;

      const rect = canvas.getBoundingClientRect();
      const scaleX = image.width / rect.width;
      const scaleY = image.height / rect.height;
      const x = Math.floor((event.clientX - rect.left) * scaleX);
      const y = Math.floor((event.clientY - rect.top) * scaleY);

      if (x < 0 || x >= image.width || y < 0 || y >= image.height) {
        return null;
      }

      return { x, y };
    }

    function getPointFromTableEvent(event) {
      if (!image) return null;

      const cell = event.target.closest("td[data-x][data-y]");
      if (!cell || !tableContainer.contains(cell)) {
        return null;
      }

      const x = Number(cell.dataset.x);
      const y = Number(cell.dataset.y);
      if (x < 0 || x >= image.width || y < 0 || y >= image.height) {
        return null;
      }

      return { x, y };
    }

    function render() {
      if (!image) {
        coordLabel.textContent = "Centro: [ - , - ]";
        tableContainer.innerHTML = "";
        setMarker(null);
        return;
      }

      center.x = clamp(center.x, 0, image.width - 1);
      center.y = clamp(center.y, 0, image.height - 1);
      coordLabel.textContent = `Centro: [ ${center.x}, ${center.y} ]`;

      const startX = center.x - radius;
      const startY = center.y - radius;

      let html = '<table class="pixel-grid"><thead><tr>';
      html += '<th>X&rarr;<br>Y&darr;</th>';

      for (let j = 0; j < (radius * 2) + 1; j += 1) {
        const x = startX + j;
        html += `<th>${x >= 0 && x < image.width ? x : ""}</th>`;
      }

      html += "</tr></thead><tbody>";

      for (let i = 0; i < (radius * 2) + 1; i += 1) {
        const y = startY + i;
        const validY = y >= 0 && y < image.height;
        html += `<tr><th>${validY ? y : ""}</th>`;

        for (let j = 0; j < (radius * 2) + 1; j += 1) {
          const x = startX + j;
          const out = !validY || x < 0 || x >= image.width;
          const value = out ? "-" : Math.round(image.pixels[(y * image.width) + x]);
          const isCenter = x === center.x && y === center.y;
          const isHover = hover && hover.x === x && hover.y === y;

          let className = "";
          if (out) className = "outside";
          if (isCenter) className = "center";
          if (isHover) className = "hovered";

          html += `<td class="${className}" data-x="${x}" data-y="${y}">${value}</td>`;
        }

        html += "</tr>";
      }

      html += "</tbody></table>";
      tableContainer.innerHTML = html;

      const markerPoint = markerMode === "selected"
        ? center
        : markerMode === "hover-or-selected"
          ? (hover || center)
          : hover;

      setMarker(markerPoint);
    }

    canvas.addEventListener("mousemove", (event) => {
      hover = getPointFromCanvasEvent(event);
      render();
    });

    canvas.addEventListener("mouseleave", () => {
      hover = null;
      render();
    });

    canvas.addEventListener("click", (event) => {
      const point = getPointFromCanvasEvent(event);
      if (!point) return;

      center = point;
      hover = point;
      render();
    });

    tableContainer.addEventListener("mousemove", (event) => {
      hover = getPointFromTableEvent(event);
      render();
    });

    tableContainer.addEventListener("mouseleave", () => {
      hover = null;
      render();
    });

    tableContainer.addEventListener("click", (event) => {
      const point = getPointFromTableEvent(event);
      if (!point) return;

      center = point;
      hover = point;
      render();
    });

    return {
      setImage(nextImage, resetCenter = true, preferredCenter = null) {
        image = nextImage;
        hover = null;

        if (image && preferredCenter) {
          center = {
            x: preferredCenter.x,
            y: preferredCenter.y
          };
        } else if (image && resetCenter) {
          center = {
            x: Math.floor(image.width / 2),
            y: Math.floor(image.height / 2)
          };
        }

        render();
      },
      clear() {
        image = null;
        hover = null;
        render();
      },
      refresh() {
        render();
      },
      getCenter() {
        return { x: center.x, y: center.y };
      }
    };
  }

  window.PixelInspector = {
    create: createInspector
  };
})();
