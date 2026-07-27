import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import * as recurringService from '../services/recurring.service.js';

export const listTemplates = asyncHandler(async (req, res) => {
  const templates = await recurringService.listTemplates(req.query);
  ApiResponse.success(res, templates);
});

export const getTemplate = asyncHandler(async (req, res) => {
  const template = await recurringService.getTemplateById(req.params.id);
  ApiResponse.success(res, template);
});

export const createTemplate = asyncHandler(async (req, res) => {
  const template = await recurringService.createTemplate(req.body, req.user);
  ApiResponse.created(res, template, 'Recurring template created');
});

export const updateTemplate = asyncHandler(async (req, res) => {
  const template = await recurringService.updateTemplate(req.params.id, req.body, req.user);
  ApiResponse.success(res, template, 'Recurring template updated');
});

export const deleteTemplate = asyncHandler(async (req, res) => {
  await recurringService.deleteTemplate(req.params.id);
  ApiResponse.success(res, null, 'Recurring template deleted');
});

export const generateTemplate = asyncHandler(async (req, res) => {
  const result = await recurringService.generateFromTemplate(req.params.id, req.user, {
    asOf: req.body?.asOf,
  });
  ApiResponse.success(res, result, result.skipped ? 'Nothing generated' : 'Expense generated');
});

export const generateAllDue = asyncHandler(async (req, res) => {
  const result = await recurringService.generateAllDue(req.user, {
    asOf: req.body?.asOf || req.query?.asOf,
  });
  ApiResponse.success(res, result, `Generated ${result.created} expense(s)`);
});
