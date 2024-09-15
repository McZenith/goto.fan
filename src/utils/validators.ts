import { UserInputError } from 'apollo-server-express';

export const validateRegisterInput = (
    { username, email, password }: { username: string; email: string; password: string }
) => {
    const errors: Record<string, string> = {};

    if (username.trim() === '') {
        errors.username = 'Username must not be empty';
    }

    if (email.trim() === '') {
        errors.email = 'Email must not be empty';
    } else {
        const regEx = /^([0-9a-zA-Z]([-.\w]*[0-9a-zA-Z])*@([0-9a-zA-Z][-\w]*[0-9a-zA-Z]\.)+[a-zA-Z]{2,9})$/;
        if (!email.match(regEx)) {
            errors.email = 'Email must be a valid email address';
        }
    }

    if (password === '') {
        errors.password = 'Password must not be empty';
    } else if (password.length < 6) {
        errors.password = 'Password must be at least 6 characters long';
    }

    return {
        errors,
        valid: Object.keys(errors).length < 1,
    };
};

export const validateLoginInput = (
    { email, password }: { email: string; password: string }
) => {
    const errors: Record<string, string> = {};

    if (email.trim() === '') {
        errors.email = 'Email must not be empty';
    }
    if (password === '') {
        errors.password = 'Password must not be empty';
    }

    return {
        errors,
        valid: Object.keys(errors).length < 1,
    };
};

export const validateLinkInput = (
    { originalUrl }: { originalUrl: string }
) => {
    const errors: Record<string, string> = {};

    if (originalUrl.trim() === '') {
        errors.originalUrl = 'URL must not be empty';
    } else {
        try {
            new URL(originalUrl);
        } catch (error) {
            errors.originalUrl = 'Invalid URL format';
        }
    }

    return {
        errors,
        valid: Object.keys(errors).length < 1,
    };
};