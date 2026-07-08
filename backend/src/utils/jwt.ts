
/* eslint-disable @typescript-eslint/no-explicit-any */
import jwt, { JwtPayload, SignOptions } from "jsonwebtoken";


// Pin HMAC-SHA256 on both sign and verify. Explicitly constraining the
// algorithm prevents algorithm-confusion attacks and forged `alg: none` tokens.
const createToken = (payload: JwtPayload, secret: string, options: SignOptions) => {
    const token = jwt.sign(payload, secret, { ...options, algorithm: "HS256" });
    return token;
}

const verifyToken = (token: string, secret: string) => {
    try {
        const decoded = jwt.verify(token, secret, { algorithms: ["HS256"] }) as JwtPayload;
        return {
            success: true,
            data: decoded
        }
    } catch (error: any) {
        return {
            success: false,
            message: error.message,
            error
        }
    }
}

const decodeToken = (token: string) => {
    const decoded = jwt.decode(token) as JwtPayload;
    return decoded;
}


export const jwtUtils = {
    createToken,
    verifyToken,
    decodeToken,
}