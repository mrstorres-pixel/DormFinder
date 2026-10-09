<?php

namespace App\Policies;

use App\Models\Property;
use App\Models\User;
use Illuminate\Auth\Access\Response;

class PropertyPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->role === 'landlord' && $user->status === 'active';
    }

    public function create(User $user): bool
    {
        return $this->viewAny($user);
    }

    public function view(User $user, Property $property): Response
    {
        return $this->viewAny($user) && $property->landlord_id === $user->id
            ? Response::allow()
            : Response::denyAsNotFound();
    }

    public function update(User $user, Property $property): Response
    {
        $ownership = $this->view($user, $property);
        if ($ownership->denied()) {
            return $ownership;
        }

        return in_array($property->status, ['draft', 'rejected', 'approved'], true)
            ? Response::allow()
            : Response::denyWithStatus(409);
    }
}
