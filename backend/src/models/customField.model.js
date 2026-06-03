/**
 * @file 租户自定义字段模型（全行业 SaaS 核心能力）
 *
 * 表：
 *   - tenant_custom_field_defs   → 字段定义（EAV 的 class）
 *   - tenant_customer_field_values → 值（EAV 的 instance）
 */
import { DataTypes } from 'sequelize';

export class CustomFieldDef {
  /** @param {import('sequelize').Sequelize} sequelize */
  static initModel(sequelize) {
    CustomFieldDef.model = sequelize.define(
      'CustomFieldDef',
      {
        id:          { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id:   { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        field_key:   { type: DataTypes.STRING(64),   allowNull: false },
        field_label: { type: DataTypes.STRING(128),  allowNull: false },
        field_type:  {
          type: DataTypes.ENUM('text', 'number', 'date', 'select', 'multi_select', 'checkbox', 'textarea'),
          allowNull: false,
          defaultValue: 'text',
        },
        options:       { type: DataTypes.JSON, allowNull: true },
        group_name:    { type: DataTypes.STRING(64), allowNull: true },
        is_required:   { type: DataTypes.BOOLEAN, defaultValue: false },
        display_order: { type: DataTypes.INTEGER, defaultValue: 0 },
        is_active:     { type: DataTypes.BOOLEAN, defaultValue: true },
        placeholder:   { type: DataTypes.STRING(255), allowNull: true },
        help_text:     { type: DataTypes.STRING(500), allowNull: true },
      },
      {
        tableName: 'tenant_custom_field_defs',
        timestamps: true,
        underscored: true,
      },
    );
    return CustomFieldDef.model;
  }
}

export class CustomerFieldValue {
  /** @param {import('sequelize').Sequelize} sequelize */
  static initModel(sequelize) {
    CustomerFieldValue.model = sequelize.define(
      'CustomerFieldValue',
      {
        id:          { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id:   { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        customer_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        field_id:    { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        value:       { type: DataTypes.TEXT, allowNull: true },
      },
      {
        tableName: 'tenant_customer_field_values',
        timestamps: true,
        underscored: true,
      },
    );
    return CustomerFieldValue.model;
  }
}
