/**
 * @file 预约到店模型（租户 scope）。
 * 状态机：booked → arrived → completed，或 no_show / cancelled 终止。
 */
import { DataTypes, Model } from 'sequelize';

export class Appointment extends Model {
  static initModel(sequelize) {
    Appointment.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        customer_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        /** 服务人员 users.id */
        staff_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        /** 预约项目 products.id */
        product_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        title: { type: DataTypes.STRING(200), allowNull: false },
        start_at: { type: DataTypes.DATE, allowNull: false },
        duration_min: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false, defaultValue: 60 },
        /** booked / arrived / completed / no_show / cancelled */
        status: { type: DataTypes.STRING(24), allowNull: false, defaultValue: 'booked' },
        source: { type: DataTypes.STRING(50), allowNull: true },
        arrived_at: { type: DataTypes.DATE, allowNull: true },
        completed_at: { type: DataTypes.DATE, allowNull: true },
        cancel_reason: { type: DataTypes.STRING(200), allowNull: true },
        remark: { type: DataTypes.STRING(500), allowNull: true },
        metadata: { type: DataTypes.JSON, allowNull: true },
        created_by: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
      },
      {
        sequelize,
        modelName: 'Appointment',
        tableName: 'appointments',
        underscored: true,
        scopes: {
          tenant(tenantId) {
            return { where: { tenant_id: tenantId } };
          },
        },
      },
    );
    return Appointment;
  }
}
