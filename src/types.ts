export interface User {
  id: string;
  username: string;
  email: string;
  verified: boolean;
}

export interface AuthResponse {
  user: User;
  sessionId: string;
  isActiveDevice: boolean;
  needsVerification?: boolean;
}
