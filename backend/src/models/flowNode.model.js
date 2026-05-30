import { DataTypes, Model } from 'sequelize';

export class FlowNode extends Model {
  static initModel(sequelize) {
    FlowNode.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        flow_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        node_key: { type: DataTypes.STRING(64), allowNull: false },
        type: { type: DataTypes.STRING(32), allowNull: false },
        config: { type: DataTypes.JSON, allowNull: false },
        position_x: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        position_y: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      },
      {
        sequelize,
        modelName: 'FlowNode',
        tableName: 'flow_nodes',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: false,
      },
    );
    return FlowNode;
  }
}
