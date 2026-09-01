import { adminConfig } from '../config';
import { adminApiHttp } from './admin-api-http';
import { adminApi as adminApiMock } from './admin-api-mock';
import type { AdminApiContract } from '../contracts/admin-api';

export const adminApi: AdminApiContract = adminConfig.useMock ? adminApiMock : adminApiHttp;
