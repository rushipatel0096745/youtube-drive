let accessToken = "";

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SET_TOKEN") {
    accessToken = event.data.token;
  }
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/drive-stream/")) {
    const fileId = url.pathname.replace("/drive-stream/", "");
    const driveUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

    const headers = new Headers();
    if (accessToken) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }
    const range = event.request.headers.get("Range");
    if (range) {
      headers.set("Range", range);
    }

    event.respondWith(
      fetch(driveUrl, {
        headers,
        mode: "cors",
      })
    );
  }
});
