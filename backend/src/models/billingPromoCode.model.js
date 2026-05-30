/**
 * @file 套餐兑换码（平台方创建）。
 */
import { DataTypes, Model } from 'sequelize';

export class BillingPromoCode extends Model {
  static initModel(sequelize) {
    BillingPromoCode.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        code: { type: DataTypes.STRING(32), allowNull: false, unique: true },
        plan_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        billing_cycle: {
          type: DataTypes.ENUM('monthly', 'yearly'),
          allowNull: false,
          defaultValue: 'yearly',
        },
        max_redemptions: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
        redemption_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        valid_until: { type: DataTypes.DATE, allowNull: true },
        note: { type: DataTypes.STRING(255), allowNull: true },
        created_by_user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
      },
      {
        sequelize,
        modelName: 'BillingPromoCode',
        tableName: 'billing_promo_codes',
        underscored: true,
        timestamps: true,
      },
    );
    return BillingPromoCode;
  }
}
