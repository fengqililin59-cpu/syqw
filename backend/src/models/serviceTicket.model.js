/**
 * @file 售后/服务工单。
 */
import { DataTypes, Model } from 'sequelize';

export class ServiceTicket extends Model {
  static initModel(sequelize) {
    ServiceTicket.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        customer_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        order_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        thread_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        type: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'consultation' },
        priority: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'normal' },
        status: { type: DataTypes.STRING(24), allowNull: false, defaultValue: 'open' },
        title: { type: DataTypes.STRING(200), allowNull: false },
        description: { type: DataTypes.TEXT, allowNull: true },
        resolution: { type: DataTypes.TEXT, allowNull: true },
        owner_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        resolved_at: { type: DataTypes.DATE, allowNull: true },
        due_at: { type: DataTypes.DATE, allowNull: true },
        first_response_at: { type: DataTypes.DATE, allowNull: true },
        sla_escalated_at: { type: DataTypes.DATE, allowNull: true },
        created_by: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
      },
      {
        sequelize,
        modelName: 'ServiceTicket',
        tableName: 'service_tickets',
        underscored: true,
      },
    );
    return ServiceTicket;
  }
}
