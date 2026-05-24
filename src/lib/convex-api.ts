type ConvexFormat = "json";

interface ConvexSuccess<T> {
  status: "success";
  value: T;
}

interface ConvexError {
  status: "error";
  errorMessage: string;
}

type ConvexResponse<T> = ConvexSuccess<T> | ConvexError;

export interface RemoteReading {
  _id: string;
  userId: string;
  systolic: number;
  diastolic: number;
  pulse: number;
  timestamp: string;
  note?: string;
}

export interface RemotePreferences {
  pressure: {
    lowSys: number;
    lowDia: number;
    elevatedSys: number;
    high1Sys: number;
    high1Dia: number;
    high2Sys: number;
    high2Dia: number;
    high3Sys: number;
    high3Dia: number;
  };
  pulse: {
    low: number;
    high: number;
  };
}

export interface RemoteUser {
  id: string;
  email: string;
  name: string;
  age?: number;
}

interface RemoteUserState {
  readings: RemoteReading[];
  preferences: RemotePreferences | null;
}

interface LoginCodeResult {
  expiresAt: number;
  devCode?: string;
}

interface VerifyLoginResult {
  user: RemoteUser;
  isReturning: boolean;
  loginCount: number;
}

const convexUrl = import.meta.env.VITE_CONVEX_URL;

const convexCall = async <T>(
  kind: "query" | "mutation" | "action",
  path: string,
  args: Record<string, unknown>
): Promise<T> => {
  if (!convexUrl) {
    throw new Error("Brak VITE_CONVEX_URL. Ustaw URL wdrożenia Convex w .env.local.");
  }

  const response = await fetch(`${convexUrl}/api/${kind}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      path,
      args,
      format: "json" satisfies ConvexFormat,
    }),
  });

  if (!response.ok) {
    throw new Error(`Błąd HTTP Convex: ${response.status}`);
  }

  const payload = (await response.json()) as ConvexResponse<T>;
  if (payload.status === "error") {
    throw new Error(payload.errorMessage || "Błąd Convex");
  }

  return payload.value;
};

export const requestLoginCodeRemote = async (
  email: string,
  isRegistration?: boolean
): Promise<LoginCodeResult> => {
  // Backward compatibility with older deployed backend versions
  // where isRegistration was required.
  const callWithFallback = async (): Promise<LoginCodeResult> => {
    try {
      return await convexCall<LoginCodeResult>("action", "bp:sendLoginCode", { email });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("isRegistration")) {
        throw error;
      }

      try {
        return await convexCall<LoginCodeResult>("action", "bp:sendLoginCode", {
          email,
          isRegistration: false,
        });
      } catch (loginError) {
        const loginMessage = loginError instanceof Error ? loginError.message : String(loginError);
        if (loginMessage.includes("Nie znaleziono konta")) {
          return convexCall<LoginCodeResult>("action", "bp:sendLoginCode", {
            email,
            isRegistration: true,
          });
        }
        throw loginError;
      }
    }
  };

  if (typeof isRegistration !== "boolean") {
    return callWithFallback();
  }

  const args: { email: string; isRegistration?: boolean } = { email };
  args.isRegistration = isRegistration;
  return convexCall<LoginCodeResult>("action", "bp:sendLoginCode", args);
};

export const verifyLoginCodeRemote = async (
  email: string,
  code: string,
  name?: string,
  age?: number
): Promise<VerifyLoginResult> => {
  return convexCall<VerifyLoginResult>("mutation", "bp:verifyLoginCode", {
    email,
    code,
    name,
    age,
  });
};

export const getUserStateRemote = async (userId: string): Promise<RemoteUserState> => {
  return convexCall<RemoteUserState>("query", "bp:getUserState", { userId });
};

export const savePreferencesRemote = async (
  userId: string,
  preferences: RemotePreferences
): Promise<void> => {
  await convexCall("mutation", "bp:savePreferences", { userId, preferences });
};

export const addReadingRemote = async (
  userId: string,
  reading: {
    systolic: number;
    diastolic: number;
    pulse: number;
    timestamp: string;
    note?: string;
  }
): Promise<RemoteReading> => {
  return convexCall<RemoteReading>("mutation", "bp:addReading", { userId, reading });
};

export const deleteReadingRemote = async (userId: string, readingId: string): Promise<void> => {
  await convexCall("mutation", "bp:deleteReading", { userId, readingId });
};
