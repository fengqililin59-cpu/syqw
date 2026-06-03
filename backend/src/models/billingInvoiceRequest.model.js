/**
 * @file 租户开票申请。
 */
import { DataTypes, Model } from 'sequelize';

export class BillingInvoiceRequest extends Model {
  static initModel(sequelize) {
    BillingInvoiceRequest.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        requested_by: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        payment_record_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        invoice_type: {
          type: DataTypes.ENUM('vat_special', 'vat_normal', 'electronic'),
          allowNull: false,
          defaultValue: 'electronic',
        },
        title: { type: DataTypes.STRING(200), allowNull: false },
        tax_no: { type: DataTypes.STRING(32), allowNull: false },
        amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
        email: { type: DataTypes.STRING(120), allowNull: false },
        mailing_address: { type: DataTypes.STRING(255), allowNull: true },
        remark: { type: DataTypes.STRING(500), allowNull: true },
        admin_remark: { type: DataTypes.STRING(500), allowNull: true },
        status: {
          type: DataTypes.ENUM('pending', 'processing', 'issued', 'rejected'),
          allowNull: false,
          defaultValue: 'pending',
        },
        issued_at: { type: DataTypes.DATE, allowNull: true },
        invoice_file_path: { type: DataTypes.STRING(500), allowNull: true },
        invoice_number: { type: DataTypes.STRING(32), allowNull: true },
        issued_by: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
      },
      {
        sequelize,
        modelName: 'BillingInvoiceRequest',
        tableName: 'billing_invoice_requests',
        underscored: true,
      },
    );
    return BillingInvoiceRequest;
  }
}
