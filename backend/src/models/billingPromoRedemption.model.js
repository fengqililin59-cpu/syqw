/**
 * @file 兑换码核销记录。
 */
import { DataTypes, Model } from 'sequelize';

export class BillingPromoRedemption extends Model {
  static initModel(sequelize) {
    BillingPromoRedemption.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        promo_code_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        redeemed_by_user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        redeemed_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      },
      {
        sequelize,
        modelName: 'BillingPromoRedemption',
        tableName: 'billing_promo_redemptions',
        underscored: true,
        timestamps: false,
      },
    );
    return BillingPromoRedemption;
  }
}
