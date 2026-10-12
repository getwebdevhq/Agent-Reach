export default {
  async fetch(request, env) {
    if (env.ASSETS) {
      const url = new URL(request.url);
      const response = await env.ASSETS.fetch(request);
      if (response.status === 404 && !url.pathname.includes('.')) {
        return env.ASSETS.fetch(new Request(new URL('/index.html', request.url), request));
      }
      return response;
    }
    return new Response('OK', { status: 200 });
  }
};
