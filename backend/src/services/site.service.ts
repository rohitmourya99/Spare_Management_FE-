import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { parsePagination, buildPagination } from '../utils/response.util';

export class SiteService {
  async getAll(filters: { search?: string; city?: string; state?: string; page?: string; limit?: string }) {
    const { page, limit, skip } = parsePagination(filters);

    const where: any = {};
    if (filters.search) {
      where.OR = [
        { siteName: { contains: filters.search } },
        { city: { contains: filters.search } },
        { contactPerson: { contains: filters.search } },
        { pin: { contains: filters.search } },
      ];
    }
    if (filters.city) where.city = { contains: filters.city };
    if (filters.state) where.state = { contains: filters.state };

    const [sites, total] = await Promise.all([
      prisma.site.findMany({
        where,
        orderBy: { siteName: 'asc' },
        skip,
        take: limit,
      }),
      prisma.site.count({ where }),
    ]);

    return { sites, pagination: buildPagination(page, limit, total) };
  }

  async getById(id: string) {
    const site = await prisma.site.findUnique({ where: { id } });
    if (!site) throw new AppError(404, 'Site not found');
    return site;
  }

  async create(data: {
    siteName: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    pin?: string;
    contactPerson?: string;
    phone?: string;
    email?: string;
    remarks?: string;
  }) {
    const fullAddress = [data.addressLine1, data.addressLine2, data.city, data.state, data.pin]
      .filter(Boolean)
      .join(', ');

    return await prisma.site.create({ data: { ...data, fullAddress } });
  }

  async update(id: string, data: Partial<Parameters<SiteService['create']>[0]>) {
    const site = await prisma.site.findUnique({ where: { id } });
    if (!site) throw new AppError(404, 'Site not found');

    const fullAddress = [
      data.addressLine1 ?? site.addressLine1,
      data.addressLine2 ?? site.addressLine2,
      data.city ?? site.city,
      data.state ?? site.state,
      data.pin ?? site.pin,
    ]
      .filter(Boolean)
      .join(', ');

    return await prisma.site.update({ where: { id }, data: { ...data, fullAddress } });
  }

  async delete(id: string) {
    const site = await prisma.site.findUnique({ where: { id } });
    if (!site) throw new AppError(404, 'Site not found');
    await prisma.site.delete({ where: { id } });
  }

  async getAll_dropdown() {
    return await prisma.site.findMany({
      where: { isActive: true },
      select: { id: true, siteName: true, city: true, state: true, contactPerson: true, phone: true, email: true, fullAddress: true },
      orderBy: { siteName: 'asc' },
    });
  }
}

export const siteService = new SiteService();
