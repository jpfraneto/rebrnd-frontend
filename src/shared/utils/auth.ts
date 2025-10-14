const FARCASTER_TOKEN_KEY = "farcaster_token";

export const setFarcasterToken = (token: string) => {
  localStorage.setItem(FARCASTER_TOKEN_KEY, token);
};

export const getFarcasterToken = () => {
  const token = localStorage.getItem(FARCASTER_TOKEN_KEY);
  return token;
};

export const removeFarcasterToken = () => {
  localStorage.removeItem(FARCASTER_TOKEN_KEY);
};
