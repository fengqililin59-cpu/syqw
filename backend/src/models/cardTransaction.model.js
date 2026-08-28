/**
 * @file 卡项消耗流水。times_after / amount_after 为变动后快照，用于对账。
 * type=adjust（手工调整）必须带 reason，并同时写入审计日志。
 */
import { DataTypes, Model } from 'sequelize';

export class CardTransaction extends Model {
  static initModel(sequelize) {
    CardTransaction.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        card_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        /** 冗余，便于按客户查流水 */
        customer_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        appointment_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        /** consume / recharge / refund / adjust */
        type: { type: DataTypes.STRING(24), allowNull: false },
        times_delta: { type: DataTypes.INTEGER, allowNull: true },
        amount_delta: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
        times_after: { type: DataTypes.INTEGER, allowNull: true },
        amount_after: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
        reason: { type: DataTypes.STRING(200), allowNull: true },
        operator_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
      },
      {
        sequelize,
        modelName: 'CardTransaction',
        tableName: 'card_transactions',
        underscored: true,
        updatedAt: false,
      },
    );
    return CardTransaction;
  }
}
