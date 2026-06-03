/**
 * @file Contract 模型 — 合同管理（对齐 database/083_add_contracts.sql）
 */
import { DataTypes, Model } from 'sequelize';

export class Contract extends Model {
  static initModel(sequelize) {
    Contract.init(
      {
        id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        customer_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        owner_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, comment: '负责人' },
        title: { type: DataTypes.STRING(200), allowNull: false, comment: '合同标题' },
        contract_no: { type: DataTypes.STRING(100), allowNull: true, comment: '合同编号' },
        type: {
          type: DataTypes.ENUM('sales', 'service', 'nda', 'other'),
          allowNull: false,
          defaultValue: 'sales',
        },
        status: {
          type: DataTypes.ENUM('draft', 'pending', 'signed', 'active', 'expired', 'terminated'),
          allowNull: false,
          defaultValue: 'draft',
        },
        amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
        currency: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'CNY' },
        signed_at: { type: DataTypes.DATE, allowNull: true },
        start_date: { type: DataTypes.DATEONLY, allowNull: true },
        end_date: { type: DataTypes.DATEONLY, allowNull: true },
        party_a: { type: DataTypes.STRING(200), allowNull: true },
        party_b: { type: DataTypes.STRING(200), allowNull: true },
        content: { type: DataTypes.TEXT, allowNull: true },
        attachment_url: { type: DataTypes.STRING(500), allowNull: true, comment: '合同文件URL' },
        reminder_days: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 7 },
        notes: { type: DataTypes.TEXT, allowNull: true },
      },
      {
        sequelize,
        modelName: 'Contract',
        tableName: 'contracts',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
          { fields: ['tenant_id'] },
          { fields: ['customer_id'] },
          { fields: ['owner_id'] },
          { fields: ['status'] },
        ],
      },
    );
    return Contract;
  }
}

export default Contract;
