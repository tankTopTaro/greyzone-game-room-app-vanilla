const audioCache = { current: new Map() };

const preloadAudio = async (audioName) => {
  if (audioCache.current.has(audioName)) return; // Already cached

  try {
    const response = await fetch(`/api/game-audio/${audioName}`);

    if (response.status === 200) {
      const data = response.data;
      const audio = new Audio(data.url);

      audio.preload = 'auto';
      audioCache.current.set(audioName, audio);
    }
  } catch (error) {
    console.error(`Failed to preload ${audioName}:`, error);
  }
};

const playAudio = async (audioName) => {
  if (!audioCache.current.has(audioName)) {
    console.warn(`Audio not preloaded. Preloading ${audioName} now...`);
    await preloadAudio(audioName);
  }

  return new Promise((resolve, reject) => {
    const audio = audioCache.current.get(audioName);

    if (!audio) {
      reject(new Error(`Audio not found: ${audioName}`));
      return;
    }

    const clone = audio.cloneNode();
    clone.muted = true;
    clone.play()
      .then(() => {
        clone.muted = false;
        resolve();
      })
      .catch((err) => {
        console.error(`Autoplay failed: ${audioName}`, err);
        reject(err);
      });
  });
};

export { preloadAudio, playAudio };