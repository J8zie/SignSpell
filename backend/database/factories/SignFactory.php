<?php

namespace Database\Factories;

use App\Models\Sign;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Sign>
 */
class SignFactory extends Factory
{
    protected $model = Sign::class;

    public function definition(): array
    {
        return [
            'sign_type' => 'word',
            'label' => 'W'.strtoupper(fake()->unique()->bothify('??####')),
            'image_url' => 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_800/signs/demo',
            'image_public_id' => 'signs/demo-'.fake()->unique()->numerify('####'),
            'userownership_id' => null,
        ];
    }
}
