import { prisma } from '../../config/prisma';
import { normalizeBranchId } from '../../utils/branch-mapping';

export interface CreateClientInput {
  nationalId: string;
  firstName: string;
  lastName?: string;
  phone?: string;
  address?: string;
  branchId: string;
  nicImage?: string;
  signatureImage?: string;
  createdByUserId?: string;
}

export class ClientsService {
  async getClients(options: { branchId?: string; search?: string; userRole?: string; limit?: number; offset?: number }) {
    const { branchId, search, userRole, limit = 50, offset = 0 } = options;

    const where: any = {};

    // Branch scoping: If not ADMIN or AUDITOR with HQ, filter by branchId
    if (branchId && branchId !== 'ALL') {
      where.branchId = normalizeBranchId(branchId);
    }

    if (search && search.trim() !== '') {
      const q = search.trim();
      where.OR = [
        { nationalId: { contains: q, mode: 'insensitive' } },
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        include: {
          branch: { select: { id: true, name: true } },
          _count: { select: { pawns: true } },
        },
      }),
      prisma.client.count({ where }),
    ]);

    return { clients, total };
  }

  async getClientById(id: string) {
    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        branch: true,
        pawns: {
          orderBy: { createdAt: 'desc' },
          include: { items: true },
        },
      },
    });
    if (!client) throw new Error('Client not found');
    return client;
  }

  async createClient(data: CreateClientInput) {
    const normBranch = normalizeBranchId(data.branchId);

    // Check if client with this NIC already exists in this branch
    const existing = await prisma.client.findUnique({
      where: {
        branchId_nationalId: {
          branchId: normBranch,
          nationalId: data.nationalId.trim().toUpperCase(),
        },
      },
    });

    if (existing) {
      throw new Error(`Client with National ID ${data.nationalId} already registered in branch ${normBranch}.`);
    }

    return prisma.client.create({
      data: {
        nationalId: data.nationalId.trim().toUpperCase(),
        firstName: data.firstName.trim(),
        lastName: data.lastName?.trim() || '.',
        phone: data.phone?.trim(),
        address: data.address?.trim(),
        branchId: normBranch,
        nicImage: data.nicImage,
        signatureImage: data.signatureImage,
        createdByUserId: data.createdByUserId,
      },
    });
  }

  async updateClient(id: string, data: Partial<CreateClientInput>) {
    return prisma.client.update({
      where: { id },
      data: {
        firstName: data.firstName?.trim(),
        lastName: data.lastName?.trim(),
        phone: data.phone?.trim(),
        address: data.address?.trim(),
        nicImage: data.nicImage,
        signatureImage: data.signatureImage,
      },
    });
  }
}

export const clientsService = new ClientsService();

