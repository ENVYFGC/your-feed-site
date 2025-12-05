// functions/api/youtube.js

export async function onRequest() {
  const items = [
    {
      source: "youtube",
      title: "Test Video",
      description: "If you see this, the function is working.",
      url: "https://example.com",
      thumbnail: null,
      publishedAt: new Date().toISOString(),
    },
  ];

  return new Response(JSON.stringify(items), {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
