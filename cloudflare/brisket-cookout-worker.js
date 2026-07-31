export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    try {
      if (request.method === "GET" && url.pathname === "/") {
        return await showGallery(env, url);
      }

      if (request.method === "POST" && url.pathname === "/upload") {
        return await uploadPhotos(request, env);
      }

      if (request.method === "GET" && url.pathname.startsWith("/photo/")) {
        const key = decodeURIComponent(url.pathname.slice("/photo/".length));
        return await servePhoto(key, env, false);
      }

      if (request.method === "GET" && url.pathname.startsWith("/download/")) {
        const key = decodeURIComponent(url.pathname.slice("/download/".length));
        return await servePhoto(key, env, true);
      }

      if (url.pathname === "/admin") {
        if (!isAuthorized(request, env)) {
          return unauthorizedResponse();
        }

        if (request.method === "GET") {
          return await showAdmin(env, url);
        }
      }

      if (request.method === "POST" && url.pathname === "/admin/delete") {
        if (!isAuthorized(request, env)) {
          return unauthorizedResponse();
        }

        return await deletePhoto(request, env);
      }

      return new Response("Page not found", { status: 404 });
    } catch (error) {
      return new Response(`Something went wrong: ${error.message}`, {
        status: 500,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    }
  },
};

const MAX_PHOTO_BYTES = 20 * 1024 * 1024;
const MAX_COMMENT_LENGTH = 500;

async function uploadPhotos(request, env) {
  const formData = await request.formData();
  const files = formData.getAll("photos");
  const groupComment = cleanComment(formData.get("groupComment"));

  if (!files.length) {
    return new Response("No photos were selected.", { status: 400 });
  }

  let uploaded = 0;

  for (let index = 0; index < files.length; index++) {
    const file = files[index];

    if (
      !file ||
      typeof file === "string" ||
      !file.type.startsWith("image/")
    ) {
      continue;
    }

    if (file.size > MAX_PHOTO_BYTES) {
      continue;
    }

    const individualComment = cleanComment(
      formData.get(`photoComment_${index}`)
    );
    const comment = individualComment || groupComment;

    const safeName =
      file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100) || "photo";

    const uniqueName =
      `${Date.now()}-${crypto.randomUUID()}-${safeName}`;

    await env.PHOTOS_BUCKET.put(uniqueName, file.stream(), {
      httpMetadata: {
        contentType: file.type || "application/octet-stream",
      },
      customMetadata: {
        originalName: file.name.slice(0, 200),
        comment,
      },
    });

    uploaded++;
  }

  if (uploaded === 0) {
    return new Response(
      "No valid photos were uploaded. Photos must be image files under 20 MB.",
      { status: 400 }
    );
  }

  return Response.redirect(
    new URL(`/?uploaded=${uploaded}`, request.url),
    303
  );
}

async function servePhoto(key, env, download) {
  if (!key) {
    return new Response("Photo not found.", { status: 404 });
  }

  const object = await env.PHOTOS_BUCKET.get(key);

  if (!object) {
    return new Response("Photo not found.", { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("ETag", object.httpEtag);
  headers.set("X-Content-Type-Options", "nosniff");

  if (download) {
    const filename =
      object.customMetadata?.originalName || key.split("-").slice(2).join("-");
    headers.set(
      "Content-Disposition",
      `attachment; filename="${safeHeaderFilename(filename || "cookout-photo")}"`
    );
    headers.set("Cache-Control", "private, max-age=0, must-revalidate");
  } else {
    headers.set("Cache-Control", "public, max-age=3600");
  }

  return new Response(object.body, { headers });
}

async function deletePhoto(request, env) {
  const formData = await request.formData();
  const key = formData.get("key");

  if (!key || typeof key !== "string") {
    return new Response("Missing photo key.", { status: 400 });
  }

  await env.PHOTOS_BUCKET.delete(key);

  return Response.redirect(
    new URL("/admin?deleted=1", request.url),
    303
  );
}

async function getPhotos(env) {
  const photos = [];
  let cursor;

  do {
    const result = await env.PHOTOS_BUCKET.list({
      cursor,
      limit: 1000,
      include: ["customMetadata", "httpMetadata"],
    });

    photos.push(...result.objects);
    cursor = result.truncated ? result.cursor : undefined;
  } while (cursor);

  photos.sort(
    (a, b) => new Date(b.uploaded).getTime() - new Date(a.uploaded).getTime()
  );

  return photos;
}

async function showGallery(env, url) {
  const photos = await getPhotos(env);

  const gallery =
    photos.length === 0
      ? `
        <div class="empty">
          <div class="camera">📷</div>
          <h2>No photos yet</h2>
          <p>Be the first person to share one.</p>
        </div>
      `
      : photos.map(renderPublicPhoto).join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1, viewport-fit=cover"
  >
  <title>Brisket Cookout Photos</title>
  <style>${sharedStyles()}</style>
</head>
<body>
  <header>
    <h1>Brisket Cookout</h1>
    <p>Share your photos and enjoy everyone’s memories.</p>
  </header>

  <main>
    <div id="success" class="success" hidden></div>

    <section class="upload-card">
      <h2>Add Photos</h2>
      <p>
        Select one or more photos. You may add one comment for the whole group,
        or a different comment beneath any individual photo.
      </p>

      <form id="uploadForm" method="POST" action="/upload"
            enctype="multipart/form-data">
        <input
          id="photos"
          type="file"
          name="photos"
          accept="image/*"
          multiple
          required
        >

        <label class="field-label" for="groupComment">
          Optional comment for all selected photos
        </label>
        <textarea
          id="groupComment"
          name="groupComment"
          maxlength="${MAX_COMMENT_LENGTH}"
          rows="3"
          placeholder="Example: Smoke is rolling and everyone is hungry!"
        ></textarea>

        <div id="selectedPhotos" class="selected-photos" hidden></div>

        <button id="uploadButton" type="submit">Upload Photos</button>
      </form>
    </section>

    <h2 class="gallery-heading">
      Shared Photos${photos.length ? ` (${photos.length})` : ""}
    </h2>

    <section class="gallery">
      ${gallery}
    </section>
  </main>

  <footer>
    Brisket Cookout Photo Gallery
  </footer>

  <script>
    const params = new URLSearchParams(location.search);
    const success = document.getElementById("success");
    const uploaded = Number(params.get("uploaded") || 0);

    if (uploaded > 0) {
      success.textContent =
        uploaded === 1
          ? "Your photo was uploaded."
          : uploaded + " photos were uploaded.";
      success.hidden = false;
      history.replaceState({}, "", "/");
    }

    const form = document.getElementById("uploadForm");
    const button = document.getElementById("uploadButton");
    const input = document.getElementById("photos");
    const selectedPhotos = document.getElementById("selectedPhotos");

    input.addEventListener("change", () => {
      selectedPhotos.replaceChildren();
      const files = Array.from(input.files || []);
      selectedPhotos.hidden = files.length === 0;

      files.forEach((file, index) => {
        const card = document.createElement("div");
        card.className = "selected-photo";

        const image = document.createElement("img");
        image.alt = "Selected photo preview";
        image.src = URL.createObjectURL(file);
        image.onload = () => URL.revokeObjectURL(image.src);

        const label = document.createElement("label");
        label.className = "field-label";
        label.htmlFor = "photoComment_" + index;
        label.textContent = "Optional comment for this photo";

        const textarea = document.createElement("textarea");
        textarea.id = "photoComment_" + index;
        textarea.name = "photoComment_" + index;
        textarea.maxLength = ${MAX_COMMENT_LENGTH};
        textarea.rows = 2;
        textarea.placeholder =
          "Leave blank to use the group comment above.";

        card.append(image, label, textarea);
        selectedPhotos.append(card);
      });
    });

    form.addEventListener("submit", () => {
      button.disabled = true;
      button.textContent = "Uploading…";
    });

    document.addEventListener("click", async (event) => {
      const shareButton = event.target.closest("[data-share]");
      if (!shareButton) return;

      const photoUrl = new URL(shareButton.dataset.share, location.href).href;
      const filename = shareButton.dataset.filename || "cookout-photo.jpg";
      const comment = shareButton.dataset.comment || "";

      try {
        const response = await fetch(photoUrl);
        if (!response.ok) throw new Error("Photo unavailable");
        const blob = await response.blob();
        const file = new File([blob], filename, {
          type: blob.type || "image/jpeg"
        });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: "Brisket Cookout Photo",
            text: comment,
            files: [file]
          });
          return;
        }

        if (navigator.share) {
          await navigator.share({
            title: "Brisket Cookout Photo",
            text: comment,
            url: photoUrl
          });
          return;
        }

        window.open(photoUrl, "_blank", "noopener");
      } catch (error) {
        if (error && error.name === "AbortError") return;
        window.open(photoUrl, "_blank", "noopener");
      }
    });
  </script>
</body>
</html>`;

  return htmlResponse(html);
}

function renderPublicPhoto(photo) {
  const key = encodeURIComponent(photo.key);
  const comment = cleanComment(photo.customMetadata?.comment);
  const originalName =
    photo.customMetadata?.originalName || "cookout-photo.jpg";

  return `
    <article class="photo-card">
      <a
        class="photo"
        href="/photo/${key}"
        target="_blank"
        rel="noopener"
      >
        <img
          src="/photo/${key}"
          alt="${escapeHtml(comment || "Brisket cookout photo")}"
          loading="lazy"
        >
      </a>
      ${
        comment
          ? `<p class="photo-comment">${escapeHtml(comment)}</p>`
          : ""
      }
      <div class="photo-buttons">
        <a class="small-button" href="/download/${key}">Download</a>
        <button
          class="small-button share-button"
          type="button"
          data-share="/photo/${key}"
          data-filename="${escapeHtml(originalName)}"
          data-comment="${escapeHtml(comment)}"
        >Share Photo</button>
      </div>
    </article>
  `;
}

async function showAdmin(env, url) {
  const photos = await getPhotos(env);
  const deletedMessage =
    url.searchParams.get("deleted") === "1"
      ? `<div class="success">Photo deleted.</div>`
      : "";

  const gallery =
    photos.length === 0
      ? `<div class="empty"><h2>No photos to review</h2></div>`
      : photos.map(renderAdminPhoto).join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1, viewport-fit=cover"
  >
  <title>Brisket Photo Admin</title>
  <style>${sharedStyles()}</style>
</head>
<body>
  <header>
    <h1>Photo Review</h1>
    <p>Private Brisket Cookout administration</p>
  </header>

  <main>
    ${deletedMessage}
    <div class="admin-intro">
      <a class="small-button" href="/">Return to Public Gallery</a>
      <p>${photos.length} uploaded photo${photos.length === 1 ? "" : "s"}</p>
    </div>
    <section class="gallery admin-gallery">
      ${gallery}
    </section>
  </main>

  <footer>Private administrator page</footer>
</body>
</html>`;

  return htmlResponse(html);
}

function renderAdminPhoto(photo) {
  const key = encodeURIComponent(photo.key);
  const comment = cleanComment(photo.customMetadata?.comment);
  const originalName =
    photo.customMetadata?.originalName || photo.key;
  const uploaded = new Date(photo.uploaded).toLocaleString("en-US");

  return `
    <article class="photo-card admin-card">
      <a
        class="photo"
        href="/photo/${key}"
        target="_blank"
        rel="noopener"
      >
        <img
          src="/photo/${key}"
          alt="${escapeHtml(comment || "Brisket cookout photo")}"
          loading="lazy"
        >
      </a>
      <div class="admin-details">
        <p><strong>File:</strong> ${escapeHtml(originalName)}</p>
        <p><strong>Uploaded:</strong> ${escapeHtml(uploaded)}</p>
        <p><strong>Comment:</strong> ${
          comment ? escapeHtml(comment) : "<em>None</em>"
        }</p>
      </div>
      <form method="POST" action="/admin/delete"
            onsubmit="return confirm('Delete this photo permanently?');">
        <input type="hidden" name="key" value="${escapeHtml(photo.key)}">
        <button class="delete-button" type="submit">Delete Photo</button>
      </form>
    </article>
  `;
}

function isAuthorized(request, env) {
  if (!env.ADMIN_PASSWORD) {
    return false;
  }

  const authorization = request.headers.get("Authorization") || "";
  if (!authorization.startsWith("Basic ")) {
    return false;
  }

  try {
    const decoded = atob(authorization.slice(6));
    const separator = decoded.indexOf(":");
    if (separator < 0) return false;

    const username = decoded.slice(0, separator);
    const password = decoded.slice(separator + 1);

    return username === "admin" && secureEqual(password, env.ADMIN_PASSWORD);
  } catch {
    return false;
  }
}

function unauthorizedResponse() {
  return new Response("Administrator sign-in required.", {
    status: 401,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "WWW-Authenticate": 'Basic realm="Brisket Photo Admin"',
      "Cache-Control": "no-store",
    },
  });
}

function secureEqual(a, b) {
  const encoder = new TextEncoder();
  const left = encoder.encode(String(a));
  const right = encoder.encode(String(b));

  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index++) {
    difference |=
      (left[index % left.length] || 0) ^
      (right[index % right.length] || 0);
  }

  return difference === 0;
}

function cleanComment(value) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, MAX_COMMENT_LENGTH);
}

function safeHeaderFilename(value) {
  return String(value)
    .replace(/[\r\n"]/g, "_")
    .replace(/[^\x20-\x7E]/g, "_")
    .slice(0, 180);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function htmlResponse(html) {
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin",
    },
  });
}

function sharedStyles() {
  return `
    :root {
      color-scheme: light;
      font-family: Arial, Helvetica, sans-serif;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      background: #fff8ed;
      color: #312116;
    }

    header {
      padding: 34px 18px 28px;
      text-align: center;
      color: white;
      background:
        linear-gradient(rgba(74, 25, 8, 0.76), rgba(74, 25, 8, 0.76)),
        linear-gradient(135deg, #934416, #4f1f0d);
    }

    header h1 {
      margin: 0 0 8px;
      font-size: clamp(30px, 7vw, 48px);
    }

    header p {
      margin: 0;
      font-size: 18px;
    }

    main {
      width: min(1100px, 100%);
      margin: auto;
      padding: 22px 16px 45px;
    }

    .upload-card {
      margin: 0 auto 28px;
      padding: 22px;
      max-width: 760px;
      background: white;
      border-radius: 18px;
      box-shadow: 0 6px 22px rgba(66, 35, 15, 0.13);
    }

    .upload-card h2 {
      margin: 0 0 8px;
      font-size: 25px;
      text-align: center;
    }

    .upload-card > p {
      margin: 0 0 18px;
      line-height: 1.45;
      color: #684c39;
      text-align: center;
    }

    input[type="file"] {
      display: block;
      width: 100%;
      margin-bottom: 15px;
      padding: 13px;
      border: 2px dashed #b36a32;
      border-radius: 12px;
      background: #fffaf4;
      font-size: 16px;
    }

    textarea {
      width: 100%;
      resize: vertical;
      margin: 6px 0 16px;
      padding: 12px;
      border: 1px solid #cda77e;
      border-radius: 10px;
      background: #fffdf9;
      color: #312116;
      font: inherit;
    }

    .field-label {
      display: block;
      color: #5c3c28;
      font-weight: bold;
    }

    button {
      font: inherit;
    }

    #uploadButton {
      width: 100%;
      padding: 15px 18px;
      border: 0;
      border-radius: 12px;
      background: #9a4215;
      color: white;
      font-size: 19px;
      font-weight: bold;
      cursor: pointer;
    }

    button:disabled {
      opacity: 0.65;
      cursor: wait;
    }

    .selected-photos {
      display: grid;
      gap: 14px;
      margin: 6px 0 16px;
    }

    .selected-photo {
      padding: 12px;
      border: 1px solid #ead5bf;
      border-radius: 12px;
      background: #fffaf4;
    }

    .selected-photo img {
      display: block;
      width: 100%;
      max-height: 260px;
      margin-bottom: 12px;
      border-radius: 9px;
      object-fit: contain;
      background: #ead9c8;
    }

    .success {
      max-width: 760px;
      margin: 0 auto 20px;
      padding: 13px;
      border-radius: 10px;
      background: #e7f7e7;
      color: #1e6326;
      text-align: center;
      font-weight: bold;
    }

    .gallery-heading {
      margin: 0 0 15px;
      text-align: center;
      font-size: 26px;
    }

    .gallery {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
      gap: 14px;
    }

    .photo-card {
      overflow: hidden;
      border-radius: 13px;
      background: white;
      box-shadow: 0 3px 12px rgba(60, 34, 18, 0.14);
    }

    .photo {
      display: block;
      overflow: hidden;
      aspect-ratio: 1 / 1;
      background: #ead9c8;
    }

    .photo img {
      width: 100%;
      height: 100%;
      display: block;
      object-fit: cover;
      transition: transform 0.18s ease;
    }

    .photo:hover img {
      transform: scale(1.03);
    }

    .photo-comment {
      margin: 0;
      padding: 12px 12px 4px;
      line-height: 1.4;
      color: #4e3524;
    }

    .photo-buttons {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      padding: 12px;
    }

    .small-button,
    .share-button {
      display: inline-flex;
      min-height: 42px;
      align-items: center;
      justify-content: center;
      padding: 9px 10px;
      border: 0;
      border-radius: 9px;
      background: #9a4215;
      color: white;
      text-decoration: none;
      text-align: center;
      font-weight: bold;
      cursor: pointer;
    }

    .empty {
      grid-column: 1 / -1;
      padding: 45px 15px;
      text-align: center;
      color: #684c39;
    }

    .empty .camera {
      font-size: 55px;
    }

    .empty h2 {
      margin-bottom: 6px;
    }

    .empty p {
      margin-top: 0;
    }

    .admin-intro {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }

    .admin-intro p {
      margin: 0;
      font-weight: bold;
    }

    .admin-details {
      padding: 12px;
      line-height: 1.4;
    }

    .admin-details p {
      margin: 0 0 8px;
      overflow-wrap: anywhere;
    }

    .delete-button {
      width: calc(100% - 24px);
      margin: 0 12px 12px;
      padding: 12px;
      border: 0;
      border-radius: 9px;
      background: #a51616;
      color: white;
      font-weight: bold;
      cursor: pointer;
    }

    footer {
      padding: 18px;
      text-align: center;
      color: #785b47;
      font-size: 14px;
    }

    @media (max-width: 520px) {
      .gallery {
        grid-template-columns: 1fr;
      }

      .photo {
        aspect-ratio: 4 / 3;
      }
    }
  `;
}
