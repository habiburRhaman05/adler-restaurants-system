import { Prisma } from "../generated/prisma/client";

export const handlePrismaError = (error: any) => {
    let statusCode = 400;
    let message = "An unexpected database error occurred";
    let errorDetails = {};

    // 1. KNOWN REQUEST ERRORS (The most frequent ones)
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        switch (error.code) {
            case 'P2002': // Unique constraint
                const target = (error.meta?.target as string[])?.join(", ") || "field";
                message = `Duplicate entry found: A record with this ${target} already exists.`;
                break;
                
            case 'P2003': // Foreign key constraint
                statusCode = 409;
                message = "This record is linked to other data and cannot be modified or deleted.";
                break;

            case 'P2025': // Record not found
                statusCode = 404;
                message = (error.meta?.cause as string) || "The requested record was not found.";
                break;

            case 'P2000': // Value too long
                message = "Input overflow: One of the values provided is too long for the database column.";
                break;

            case 'P2014': // Relation violation
                message = "The change you are trying to make would violate a required relationship.";
                break;

            case 'P2024': // Connection timeout
                statusCode = 504; // Gateway Timeout
                message = "Database connection timed out. Please try again.";
                break;

            default:
                message = `Database Error (${error.code}): Contact support if this persists.`;
                break;
        }
    } 
    
    // 2. VALIDATION ERRORS (Schema mismatches)
    else if (error instanceof Prisma.PrismaClientValidationError) {
        // We keep this as 400 because it's usually a developer or bad request body error
        message = "Invalid data format: Please verify your input matches the required schema.";
    }

    // 3. INITIALIZATION ERRORS (Usually DB is down or credentials are wrong)
    else if (error instanceof Prisma.PrismaClientInitializationError) {
        statusCode = 500;
        message = "Infrastructure Error: Unable to establish a connection to the database.";
    }

    // 4. RUST ENGINE ERRORS (The rare 'Query Engine' crashes)
    else if (error instanceof Prisma.PrismaClientRustPanicError) {
        statusCode = 500;
        message = "The database engine crashed. Our team has been notified.";
    }

    // 5. UNKNOWN PRISMA ERRORS
    else if (error instanceof Prisma.PrismaClientUnknownRequestError) {
        statusCode = 500;
        message = "An unidentifiable database request error occurred.";
    }

    // 6. DRIVER ADAPTER ERRORS — with driver adapters (pg), constraint
    //    violations surface as raw driver errors rather than Prisma P-codes, so
    //    detect the common ones by message and map them to friendly conflicts.
    else if (typeof error?.message === "string") {
        const msg = error.message.toLowerCase();
        if (msg.includes("foreign key constraint")) {
            statusCode = 409;
            message = "This record is linked to other data and cannot be modified or deleted.";
        } else if (msg.includes("unique constraint")) {
            statusCode = 409;
            message = "A record with these details already exists.";
        } else if (msg.includes("not-null") || msg.includes("null value")) {
            statusCode = 400;
            message = "A required field is missing.";
        }
    }

    return {
        statusCode, 
        message,
        // Optional: include original error in development for easier debugging
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined 
    };
};