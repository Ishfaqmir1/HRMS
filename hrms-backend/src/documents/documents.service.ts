import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UploadDocumentDto } from './dto/documents.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

@Injectable()
export class DocumentsService {
  constructor(private prisma: PrismaService) {}

  async upload(companyId: string, employeeId: string, dto: UploadDocumentDto) {
    return this.prisma.employeeDocument.create({
      data: { ...dto, companyId, employeeId, category: dto.category || 'OTHER' },
    });
  }

  async findAll(employeeId: string, query: PaginationQueryDto) {
    const where = { employeeId };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.employeeDocument.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { uploadedAt: 'desc' },
      }),
      this.prisma.employeeDocument.count({ where }),
    ]);
    return {
      items,
      meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) },
    };
  }

  async remove(companyId: string, employeeId: string, id: string) {
    const doc = await this.prisma.employeeDocument.findFirst({ where: { id, companyId, employeeId } });
    if (!doc) throw new NotFoundException('Document not found.');
    return this.prisma.employeeDocument.delete({ where: { id } });
  }
}
