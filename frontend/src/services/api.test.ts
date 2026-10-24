import { describe, expect, it } from 'vitest';
import type { InternalAxiosRequestConfig } from 'axios';
import { AxiosHeaders } from 'axios';
import api from './api';
import { setTokenGetter } from '../lib/tokenStore';

type Handler = { fulfilled: (c: InternalAxiosRequestConfig) => Promise<InternalAxiosRequestConfig> };

async function runRequestInterceptors(): Promise<InternalAxiosRequestConfig> {
  let config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  const handlers = (api.interceptors.request as unknown as { handlers: Handler[] }).handlers;
  for (const h of handlers) config = await h.fulfilled(config);
  return config;
}

describe('api client', () => {
  it('attaches the Clerk session token as a bearer token', async () => {
    setTokenGetter(async () => 'jwt-123');
    expect((await runRequestInterceptors()).headers.Authorization).toBe('Bearer jwt-123');
  });

  it('sends no Authorization header when signed out', async () => {
    setTokenGetter(async () => null);
    expect((await runRequestInterceptors()).headers.Authorization).toBeUndefined();
  });
});
