/**
 * @file 平台合同开单附件元数据。
 */
import { DataTypes, Model } from 'sequelize';

export class BillingContractAttachment extends Model {
  static initModel(sequelize) {
    BillingContractAttachment.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        payment_record_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        out_trade_no: { type: DataTypes.STRING(64), allowNull: false },
        uploaded_by: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        original_name: { type: DataTypes.STRING(255), allowNull: false },
        stored_name: { type: DataTypes.STRING(128), allowNull: false },
        mime_type: { type: DataTypes.STRING(128), allowNull: false, defaultValue: 'application/octet-stream' },
        size_bytes: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      },
      {
        sequelize,
        modelName: 'BillingContractAttachment',
        tableName: 'billing_contract_attachments',
        underscored: true,
        updatedAt: false,
      },
    );
    return BillingContractAttachment;
  }
}
