import { SetMetadata } from '@nestjs/common';

export const FEATURE_FLAG_KEY = 'featureFlag';

/**
 * Restricts a route/module to companies that have the given feature flag enabled.
 *
 * ```ts
 * @FeatureFlag('payroll')
 * @Controller('payroll')
 * ```
 */
export const FeatureFlag = (featureCode: string) => SetMetadata(FEATURE_FLAG_KEY, featureCode);
