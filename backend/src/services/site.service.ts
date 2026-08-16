import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { parsePagination, buildPagination } from '../utils/response.util';
import { activityService } from './activity.service';
import { buildOrgFilter } from '../utils/orgFilter.util';

export class SiteService {
  async getAll(filters: { search?: string; city?: string; state?: string; page?: string; limit?: string }, organizationId: string = 'BHEL') {
    const { page, limit, skip } = parsePagination(filters);
    const orgFilter = buildOrgFilter(organizationId);

    const where: any = { AND: [orgFilter] };
    if (filters.search) {
      where.AND.push({
        OR: [
          { siteName: { contains: filters.search } },
          { city: { contains: filters.search } },
          { contactPerson: { contains: filters.search } },
          { pin: { contains: filters.search } },
        ],
      });
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

  async create(
    data: {
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
    },
    userId?: string,
    organizationId: string = 'BHEL'
  ) {
    const fullAddress = [data.addressLine1, data.addressLine2, data.city, data.state, data.pin]
      .filter(Boolean)
      .join(', ');

    const newSite = await prisma.site.create({ data: { ...data, fullAddress, organizationId: organizationId || 'BHEL' } });

    if (userId) {
      await activityService.logActivity({
        userId,
        module: 'Site Master',
        action: 'Site Added',
        entity: 'Site',
        entityId: newSite.id,
        entityLabel: newSite.siteName,
        siteName: newSite.siteName,
        newValue: `Contact: ${newSite.contactPerson || 'N/A'}, Address: ${fullAddress}`,
      });
    }

    return newSite;
  }

  async update(id: string, data: Partial<Parameters<SiteService['create']>[0]>, userId?: string) {
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

    const updated = await prisma.site.update({ where: { id }, data: { ...data, fullAddress } });

    if (userId) {
      let action = 'Site Master Updated';
      if (data.contactPerson || data.phone || data.email) action = 'SPOC Updated';
      if (data.addressLine1 || data.city || data.state || data.pin) action = 'Address Updated';

      await activityService.logActivity({
        userId,
        module: 'Site Master',
        action,
        entity: 'Site',
        entityId: updated.id,
        entityLabel: updated.siteName,
        siteName: updated.siteName,
        oldValue: `Contact: ${site.contactPerson || 'N/A'}, Address: ${site.fullAddress || 'N/A'}`,
        newValue: `Contact: ${updated.contactPerson || 'N/A'}, Address: ${updated.fullAddress || 'N/A'}`,
      });
    }

    return updated;
  }

  async delete(id: string, userId?: string) {
    const site = await prisma.site.findUnique({ where: { id } });
    if (!site) throw new AppError(404, 'Site not found');
    await prisma.site.delete({ where: { id } });

    if (userId) {
      await activityService.logActivity({
        userId,
        module: 'Site Master',
        action: 'Site Deleted',
        entity: 'Site',
        entityId: id,
        entityLabel: site.siteName,
        siteName: site.siteName,
      });
    }
  }

  async getAll_dropdown(organizationId: string = 'BHEL') {
    const orgFilter = buildOrgFilter(organizationId);
    return await prisma.site.findMany({
      where: { isActive: true, AND: [orgFilter] },
      select: { id: true, siteName: true, city: true, state: true, contactPerson: true, phone: true, email: true, fullAddress: true },
      orderBy: { siteName: 'asc' },
    });
  }
}

export const siteService = new SiteService();
