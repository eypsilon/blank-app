import dotenv from 'dotenv';
dotenv.config();

export const Environment = (process.env.API_ENVIRONMENT || 'prod') === 'prod' ? '' : '.' + (process.env.API_ENVIRONMENT || 'prod');
