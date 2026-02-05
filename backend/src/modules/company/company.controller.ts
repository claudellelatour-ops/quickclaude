import { Response } from 'express';
import { companyService } from './company.service';
import { AuthenticatedRequest } from '../../middleware/auth';
import { sendSuccess, sendCreated, sendNoContent } from '../../utils/response';
import { UserRole } from '@prisma/client';

export class CompanyController {
  /**
   * List user's companies
   */
  async list(req: AuthenticatedRequest, res: Response) {
    const companies = await companyService.getUserCompanies(req.user!.id);
    return sendSuccess(res, companies);
  }

  /**
   * Create a new company
   */
  async create(req: AuthenticatedRequest, res: Response) {
    const company = await companyService.createCompany(req.user!.id, req.body);
    return sendCreated(res, company, 'Company created successfully');
  }

  /**
   * Get company details
   */
  async get(req: AuthenticatedRequest, res: Response) {
    const company = await companyService.getCompany(req.params.id, req.user!.id);
    return sendSuccess(res, company);
  }

  /**
   * Update company
   */
  async update(req: AuthenticatedRequest, res: Response) {
    const company = await companyService.updateCompany(
      req.params.id,
      req.user!.id,
      req.body
    );
    return sendSuccess(res, company, 'Company updated successfully');
  }

  /**
   * Update company settings
   */
  async updateSettings(req: AuthenticatedRequest, res: Response) {
    const settings = await companyService.updateSettings(
      req.params.id,
      req.user!.id,
      req.body
    );
    return sendSuccess(res, settings, 'Settings updated successfully');
  }

  /**
   * Delete company
   */
  async delete(req: AuthenticatedRequest, res: Response) {
    await companyService.deleteCompany(req.params.id, req.user!.id);
    return sendNoContent(res);
  }

  /**
   * List company users
   */
  async listUsers(req: AuthenticatedRequest, res: Response) {
    const users = await companyService.getCompanyUsers(req.companyId!);
    return sendSuccess(res, users);
  }

  /**
   * Invite user to company
   */
  async inviteUser(req: AuthenticatedRequest, res: Response) {
    const user = await companyService.inviteUser(
      req.companyId!,
      req.user!.id,
      req.body
    );
    return sendCreated(res, user, 'Invitation sent successfully');
  }

  /**
   * Update user role
   */
  async updateUserRole(req: AuthenticatedRequest, res: Response) {
    const user = await companyService.updateUserRole(
      req.companyId!,
      req.params.userId,
      req.user!.id,
      req.body.role as UserRole
    );
    return sendSuccess(res, user, 'User role updated successfully');
  }

  /**
   * Remove user from company
   */
  async removeUser(req: AuthenticatedRequest, res: Response) {
    await companyService.removeUser(
      req.companyId!,
      req.params.userId,
      req.user!.id
    );
    return sendNoContent(res);
  }

  /**
   * Set default company
   */
  async setDefault(req: AuthenticatedRequest, res: Response) {
    await companyService.setDefaultCompany(req.user!.id, req.params.id);
    return sendSuccess(res, null, 'Default company updated');
  }
}

export const companyController = new CompanyController();
