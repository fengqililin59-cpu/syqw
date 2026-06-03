/**
 * @file 租户订阅状态。
 */
import { DataTypes, Model } from 'sequelize';

export class Subscription extends Model {
  static initModel(sequelize) {
    Subscription.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, unique: true },
        plan_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        billing_cycle: {
          type: DataTypes.ENUM('monthly', 'yearly'),
          allowNull: false,
          defaultValue: 'monthly',
        },
        status: {
          type: DataTypes.ENUM('trialing', 'active', 'expired', 'cancelled'),
          allowNull: false,
          defaultValue: 'trialing',
        },
        trial_ends_at: { type: DataTypes.DATE, allowNull: true },
        current_period_start: { type: DataTypes.DATE, allowNull: true },
        current_period_end: { type: DataTypes.DATE, allowNull: true },
        cancelled_at: { type: DataTypes.DATE, allowNull: true },
        auto_renew: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 0 },
        auto_renew_plan_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        auto_renew_cycle: { type: DataTypes.ENUM('monthly', 'yearly'), allowNull: true },
        expiry_notified_at: { type: DataTypes.DATE, allowNull: true },
        reminder_notified_at: { type: DataTypes.DATE, allowNull: true },
      },
      {
        sequelize,
        modelName: 'Subscription',
        tableName: 'subscriptions',
        underscored: true,
        timestamps: true,
      },
    );
    return Subscription;
  }
}
