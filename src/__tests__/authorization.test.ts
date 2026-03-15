import { isA, canManageProject, canWriteData, canReadData, canManageMemberships, getReportScope } from '../lib/auth-server';

// Mocks for users and auth-server behavior
jest.mock('../lib/auth-server', () => {
    const original = jest.requireActual('../lib/auth-server');
    return {
        ...original,
        getMembership: jest.fn(),
    };
});

import { getMembership } from '../lib/auth-server';

describe('RBAC Authorization Rules', () => {
    
    const userA = { id: 'admin1', role_global: 'A' };
    const userStandard = { id: 'user1', role_global: 'standard' };
    const projectId = 'proj-123';
    const otherProjectId = 'proj-456';

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('isA returns true only for A users', () => {
        expect(isA(userA)).toBe(true);
        expect(isA(userStandard)).toBe(false);
    });

    test('canManageProject (B or A)', async () => {
        expect(await canManageProject(userA, projectId)).toBe(true);

        (getMembership as jest.Mock).mockResolvedValueOnce('B');
        expect(await canManageProject(userStandard, projectId)).toBe(true);

        (getMembership as jest.Mock).mockResolvedValueOnce('C');
        expect(await canManageProject(userStandard, projectId)).toBe(false);
    });

    test('TC01: C intenta POST en proyecto no asignado -> 403', async () => {
        // C attempts to write data to unassigned project
        (getMembership as jest.Mock).mockResolvedValueOnce(null); // No membership for this project
        const canWrite = await canWriteData(userStandard, otherProjectId);
        expect(canWrite).toBe(false); // Expecting equivalent of 403
    });

    test('TC02: D intenta PATCH/DELETE en proyecto asignado -> 403', async () => {
        // user has role D
        (getMembership as jest.Mock).mockResolvedValueOnce('D');
        // attempts to write data
        const canWrite = await canWriteData(userStandard, projectId);
        expect(canWrite).toBe(false); // D cannot write
        
        // D can read
        (getMembership as jest.Mock).mockResolvedValueOnce('D');
        const canRead = await canReadData(userStandard, projectId);
        expect(canRead).toBe(true);
    });
});
