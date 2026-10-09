<?php

namespace App\Models;

use Database\Factories\CampusFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Campus extends Model
{
    /** @use HasFactory<CampusFactory> */
    use HasFactory;

    protected function casts(): array
    {
        return ['latitude' => 'float', 'longitude' => 'float', 'active' => 'boolean'];
    }
}
