<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AuditLogResource extends JsonResource
{
    // Shapes an audit row into the camelCase JSON the app expects.
    public function toArray(Request $request): array
    {
        return [
            'auditId' => $this->audit_id,
            'userId' => $this->user_id,
            'username' => $this->username,
            'userRole' => $this->user_role,
            'action' => $this->action,
            'resourceType' => $this->resource_type,
            'resourceId' => $this->resource_id,
            'description' => $this->description,
            'oldValues' => $this->old_values,
            'newValues' => $this->new_values,
            'ipAddress' => $this->ip_address,
            'userAgent' => $this->user_agent,
            'createdAt' => $this->created_at?->toIso8601String(),
        ];
    }
}
