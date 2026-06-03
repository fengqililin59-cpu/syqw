import { DataTypes, Model } from 'sequelize';

export class Task extends Model {
  /** @param {import('sequelize').Sequelize} sequelize */
  static initModel(sequelize) {
    return Task.init(
      {
        id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
        tenant_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        assignee_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        creator_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        customer_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        contract_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        title: { type: DataTypes.STRING(200), allowNull: false },
        description: { type: DataTypes.TEXT, allowNull: true },
        priority: { type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'), allowNull: false, defaultValue: 'medium' },
        status: { type: DataTypes.ENUM('todo', 'in_progress', 'done', 'cancelled'), allowNull: false, defaultValue: 'todo' },
        due_date: { type: DataTypes.DATE, allowNull: true },
        completed_at: { type: DataTypes.DATE, allowNull: true },
      },
      {
        sequelize,
        tableName: 'tasks',
        timestamps: true,
        underscored: true,
      },
    );
  }
}
