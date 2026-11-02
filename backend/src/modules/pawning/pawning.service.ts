import { prisma } from '../../config/prisma';
import { calculateSpecificGravity, getEstimatedKarat, toDecimal } from '../../utils/decimal';

export interface EvaluationInput {
  airWeight: number;
  waterWeight: number;
  askingAmount?: number;
  trueValue?: number;
  airWeightPhotoUrl?: string;
  waterWeightPhotoUrl?: string;
  status?: string;
}

export class PawningService {
  /**
   * Evaluates gold purity using Archimedes' Specific Gravity
   */
  evaluateGoldPurity(airWeight: number, waterWeight: number) {
    const sg = calculateSpecificGravity(airWeight, waterWeight);
    const estimatedKarat = getEstimatedKarat(sg);
    return {
      specificGravity: sg.toNumber(),
      estimatedKarat,
      airWeight,
      waterWeight,
    };
  }

  /**
   * Records an evaluation (whether accepted or rejected)
   */
  async recordEvaluation(input: EvaluationInput) {
    const { specificGravity, estimatedKarat } = this.evaluateGoldPurity(input.airWeight, input.waterWeight);

    return prisma.rejectedEvaluation.create({
      data: {
        airWeight: toDecimal(input.airWeight),
        waterWeight: toDecimal(input.waterWeight),
        specificGravity: toDecimal(specificGravity),
        estimatedKarat,
        askingAmount: toDecimal(input.askingAmount || 0),
        trueValue: toDecimal(input.trueValue || 0),
        status: input.status || 'EVALUATED',
        airWeightPhotoUrl: input.airWeightPhotoUrl,
        waterWeightPhotoUrl: input.waterWeightPhotoUrl,
      },
    });
  }

  /**
   * Get recent evaluations
   */
  async getEvaluations(limit = 50) {
    return prisma.rejectedEvaluation.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
  }
}

export const pawningService = new PawningService();

