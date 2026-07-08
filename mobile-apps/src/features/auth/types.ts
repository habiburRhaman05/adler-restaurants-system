export type User = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  mustChangePassword: boolean;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
};

export type LoginResponseData = {
  user: User;
};

export type ProfileUser = User & {
  contract?: Record<string, unknown>;
  rate?: Record<string, unknown>;
  contact?: Record<string, unknown>;
};

export type UpdateProfilePayload = {
  firstName?: string;
  lastName?: string;
  phone?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
};
